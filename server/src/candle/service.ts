import { DateTime } from 'luxon';

import { BrokerService } from '../broker';
import { Log } from '../infrastructure';
import { CandleCacheRepository, CandleRepository, InstrumentRepository } from '../persistance';
import { DownResolutionPipeline } from '../pipeline/downres';
import { Candle, CandleInterval, IBrokerCandle, ICandleProperties, Instrument, validateCandle } from '../types';
import { CandleUtil, sleep, toDayAndTime } from '../util';
import { CandleWritePump } from './write-pump';

function mapBrokerCandleToNativeCandle(
    instrument: Instrument,
    interval: CandleInterval,
    candle: IBrokerCandle,
): { candle: Candle | undefined; props: ICandleProperties } {
    const { id: instrumentId, exchange } = instrument;
    const properties = CandleUtil.getCandleMetaProperties({ instrumentId, interval, timestamp: candle.date });
    const { timeCode } = toDayAndTime(candle.date);
    const { key } = properties;
    const nativeCandle = {
        key,
        exchange,
        instrumentId,
        interval,
        timeCode: timeCode,
        timestamp: candle.date,
        open: candle.open,
        high: candle.high,
        low: candle.low,
        close: candle.close,
        volume: candle.volume,
        totalVolume: 0,
        openInterest: 0,
        totalOpenInterest: 0,
    };
    if (validateCandle(nativeCandle) === false) throw new Error(JSON.stringify(validateCandle.errors, undefined, 2));
    return { candle: nativeCandle, props: properties };
}

function mapBrokerCandlesToNaiveCandles(
    instrument: Instrument,
    interval: CandleInterval,
    inputCandles: IBrokerCandle[],
): Candle[] {
    const nativeCandles: Candle[] = [];
    let previousCandle: Candle | undefined;
    for (const inputCandle of inputCandles) {
        const { candle: nativeCandle, props } = mapBrokerCandleToNativeCandle(instrument, interval, inputCandle);
        if (nativeCandle == undefined) continue;
        if (props.valid === false) throw new Error(`Invalid key: ${props.key}`);
        if (props.dayBegin) {
            nativeCandle.totalVolume = nativeCandle.volume;
            nativeCandle.totalOpenInterest = nativeCandle.openInterest;
        } else if (
            previousCandle != undefined &&
            CandleUtil.parseCandleKey(previousCandle.key).day === CandleUtil.parseCandleKey(nativeCandle.key).day
        ) {
            nativeCandle.totalVolume = nativeCandle.volume + previousCandle.totalVolume;
            nativeCandle.openInterest = nativeCandle.openInterest + previousCandle.totalOpenInterest;
        }
        nativeCandles.push(nativeCandle);
        previousCandle = nativeCandle;
    }
    return nativeCandles;
}

async function downloadHistorical({
    instrument,
    interval,
    from,
    to,
}: {
    instrument: Instrument;
    interval: CandleInterval;
    from: Date;
    to: Date;
}): Promise<Candle[]> {
    const { id } = instrument;
    const rawCandles = await BrokerService.getHistorical({ id, interval, from, to });
    return mapBrokerCandlesToNaiveCandles(instrument, interval, rawCandles);
}

async function syncInstrumentHistorical({ instrument, from, to }: { instrument: Instrument; from: Date; to: Date }) {
    Log.info(`\tSyncing ${instrument.id}...`);
    const dailyCandles = await downloadHistorical({
        instrument,
        interval: CandleInterval.DAY_01,
        from: DateTime.fromJSDate(to).minus({ year: 2 }).toJSDate(),
        to,
    });
    await CandleRepository.upsertCandles(dailyCandles);
    await sleep(300);
    const oneMinuteCandles = await downloadHistorical({
        instrument,
        interval: CandleInterval.MIN_01,
        from,
        to: DateTime.fromJSDate(to).endOf('day').toJSDate(),
    });
    await CandleRepository.upsertCandles(oneMinuteCandles);
    await InstrumentRepository.updateInstrument({ id: instrument.id, historicalLastSynced: to });
    await sleep(300);
}

async function syncHistorical(): Promise<void> {
    const { from, to } = await getLastTradingDays(5);
    const instruments = await InstrumentRepository.findHistoricalNotSynced(to);
    Log.info(`Syncing historical of ${instruments.length} instruments...`);
    for (const instrument of instruments) {
        await syncInstrumentHistorical({ instrument, from, to });
        await sleep(300);
    }
}

async function getLastTradingDays(days: number): Promise<{ from: Date; to: Date }> {
    const instrumentId = 'NSE:NIFTY 50';
    const instrument = await InstrumentRepository.findById(instrumentId);
    if (instrument == undefined) throw new Error(`Can't find instrument: ${instrumentId}`);
    const now = DateTime.local();
    const dailyCandles = (
        await downloadHistorical({
            instrument,
            interval: CandleInterval.DAY_01,
            from: now.minus({ month: 1 }).toJSDate(),
            to: now.toJSDate(),
        })
    ).slice(-1 * days);
    const from = dailyCandles[0].timestamp;
    const to = dailyCandles.slice(-1)[0].timestamp;
    return { from, to };
}

function printDiff(name: string, v1: number, v2: number) {
    console.log(
        name.padStart(3, ' '),
        `${v1.toFixed(2)}`.padStart(10, ' '),
        `${v2.toFixed(2)}`.padStart(10, ` `),
        v1 - v2,
    );
}

function candleDiff(brokerCandle: Candle, databaseCandle: Candle): void {
    printDiff('T', brokerCandle.timeCode, databaseCandle.timeCode);
    printDiff('O', brokerCandle.open, databaseCandle.open);
    printDiff('H', brokerCandle.high, databaseCandle.high);
    printDiff('L', brokerCandle.low, databaseCandle.low);
    printDiff('C', brokerCandle.close, databaseCandle.close);
    printDiff('V', brokerCandle.volume, databaseCandle.volume);
}

async function verifyCandles(): Promise<void> {
    const from = DateTime.local(2020, 10, 14, 0, 0, 0).toJSDate();
    const to = DateTime.fromJSDate(from).plus({ day: 1 }).toJSDate();
    const searchOptions = {
        id: 'NFO:NIFTY20OCTFUT',
        interval: CandleInterval.MIN_05,
        from,
        to,
    };
    const instrument = await InstrumentRepository.findById(searchOptions.id);
    if (instrument == undefined) throw new Error("Can't find instrument");
    const databaseCandles = await CandleRepository.findBy(searchOptions);
    const candles = mapBrokerCandlesToNaiveCandles(
        instrument,
        searchOptions.interval,
        await BrokerService.getHistorical(searchOptions),
    );

    console.log('total candles:', candles.length, databaseCandles.length);
    for (const [i, candle] of candles.entries()) {
        candleDiff(candle, databaseCandles[i]);
    }
}

async function loadCandleBatch({ timeCode, interval }: { timeCode: number; interval: CandleInterval }) {
    const _startTime = Date.now();
    const sourceCandles = await CandleRepository.findBy({
        timeCode,
        interval,
    });
    // await CandleCacheRepository.cacheWriteCandles(sourceCandles);
    const downResPipeline = new DownResolutionPipeline(sourceCandles);
    const downResCandles = await downResPipeline.execute();
    const allCandles = [...sourceCandles, ...downResCandles];
    await CandleCacheRepository.writeCandles(allCandles);
    await CandleCacheRepository.queueForDBWrites(downResCandles);
    Log.info(`\tProcessed ${timeCode} wrote ${allCandles.length} candles in ${Date.now() - _startTime} ms`);
}

const TRADING_DAYS_IN_MEMORY = 5;
async function loadCandlesLimit(totalCodes?: number): Promise<void> {
    Log.info('Loading candles...');
    const interval = CandleInterval.MIN_01;
    const tradingDays = (await CandleRepository.getTradingDaysForInterval(interval)).slice(-1 * TRADING_DAYS_IN_MEMORY);
    Log.json(
        '\tTrading days: ',
        tradingDays.map((day) => day.toLocaleDateString()),
    );
    const from = tradingDays[0];
    const to = new Date();
    let timeCodes = await CandleRepository.getTimeCodesForInterval({ from, to, interval });
    if (totalCodes != undefined) {
        timeCodes = timeCodes.slice(totalCodes * -1);
    }
    Log.info(`\tFound ${timeCodes.length} time codes.`);
    for (const [_i, timeCode] of timeCodes.entries()) {
        await loadCandleBatch({ timeCode, interval });
    }
}

async function loadCandles(): Promise<void> {
    await CandleCacheRepository.flushCandleCache();
    return loadCandlesLimit();
}

async function debug(): Promise<void> {
    await loadCandlesLimit(25);
}

async function startWritePump(): Promise<any> {
    return CandleWritePump.start();
}

export const CandleService = {
    debug,
    syncHistorical,
    loadCandles,
    verifyCandles,
    startWritePump,
};
