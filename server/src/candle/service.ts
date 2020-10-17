import { DateTime, Duration } from 'luxon';

import { BrokerService } from '../broker';
import { CandleCacheRepository, CandleRepository } from '../database';
import { ExchangeService } from '../exchange';
import { Log } from '../infra';
import { InstrumentService } from '../instrument';
import { Candle, CandleDuration, CandleInterval, IBrokerCandle, Instrument, Tick, validateTick } from '../types';
import { INSTRUMENT_ID_SEPERATOR } from '../types';
import { validateCandle } from '../types/candle';
import { IExchangeTimeProperties } from '../types/exchange';
import { printStats, sleep, toDayAndTime } from '../util';
import { TickPipeline } from './tick-pipeline';
import { InstrumentRepository } from '../database/repository/instrument';
import lodash from 'lodash';
import { DownResPipeline } from './downres-pipeline';
import { assertNotUndefined } from '../util/ds';

type ICandleProps = IExchangeTimeProperties & { key: string };

function getCandleMetaProperties({
    instrumentId,
    interval,
    timestamp,
}: {
    instrumentId: string;
    interval: CandleInterval;
    timestamp: Date;
}): ICandleProps {
    const separator = INSTRUMENT_ID_SEPERATOR;
    const [exchange] = instrumentId.split(separator);
    const alignedTime = getAlignedTime({ exchange, interval, timestamp });
    const { day, time } = toDayAndTime(alignedTime);
    const result = {
        key: `${instrumentId}${separator}${interval}${separator}${day}${time}`,
    };
    Object.assign(result, ExchangeService.exchangeTimeProps({ exchange, timestamp, interval }));
    return result as any;
}

const _tzDiffInMs = Duration.fromObject({ hour: 5, minute: 30 }).as('millisecond');

function getAlignedTime({
    exchange,
    timestamp,
    interval,
    offset = 0,
}: {
    exchange: string;
    timestamp: Date;
    interval: CandleInterval | string;
    offset?: number;
}): Date {
    const exchangeConfig = ExchangeService.getExchangeTime(exchange);
    const intervalInMs = CandleDuration[interval as CandleInterval] * 1000;
    const dayIntervalInMs = CandleDuration[CandleInterval.DAY_01] * 1000;
    if (intervalInMs >= dayIntervalInMs) {
        const unixTime = timestamp.getTime();
        const date = new Date(unixTime - ((unixTime + _tzDiffInMs) % dayIntervalInMs));
        return date;
    } else {
        const unixTime = timestamp.getTime() - exchangeConfig.dayStartOffset;
        const alignedTime =
            unixTime - (unixTime % intervalInMs) + intervalInMs * offset + exchangeConfig.dayStartOffset;
        return new Date(alignedTime);
    }
}

function mapBrokerCandleToNativeCandle(
    instrument: Instrument,
    interval: CandleInterval,
    candle: IBrokerCandle,
): { candle: Candle | undefined; props: ICandleProps } {
    const { id: instrumentId, exchange } = instrument;
    const props = getCandleMetaProperties({ instrumentId, interval, timestamp: candle.date });
    const { timeCode } = toDayAndTime(candle.date);
    const { key } = props;
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
    return { candle: nativeCandle, props };
}

function mapBrokerCandlesToNaiveCandles(
    instrument: Instrument,
    interval: CandleInterval,
    inputCandles: IBrokerCandle[],
): Candle[] {
    const nativeCandles: Candle[] = [];
    let prevCandle: Candle | undefined;
    for (const inputCandle of inputCandles) {
        const { candle: nativeCandle, props } = mapBrokerCandleToNativeCandle(instrument, interval, inputCandle);
        if (nativeCandle == undefined) continue;
        if (props.valid === false) throw new Error(`Invalid key: ${props.key}`);
        if (props.dayBegin) {
            nativeCandle.totalVolume = nativeCandle.volume;
            nativeCandle.totalOpenInterest = nativeCandle.openInterest;
        } else if (
            prevCandle != undefined &&
            parseCandleKey(prevCandle.key).day === parseCandleKey(nativeCandle.key).day
        ) {
            nativeCandle.totalVolume = nativeCandle.volume + prevCandle.totalVolume;
            nativeCandle.openInterest = nativeCandle.openInterest + prevCandle.totalOpenInterest;
        }
        nativeCandles.push(nativeCandle);
        prevCandle = nativeCandle;
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
    console.log(`Syncing ${instrument.id} ...`);
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
        to,
    });
    await CandleRepository.upsertCandles(oneMinuteCandles);
    await InstrumentRepository.updateInstrument({ id: instrument.id, historicalLastSynced: to });
    await sleep(300);
}

async function syncHistorical(): Promise<void> {
    const { from, to } = await getLastTradingDays(5);
    const instruments = await InstrumentRepository.findHistoricalNotSynced(to);
    console.log(`Syncing historical of ${instruments.length} instruments.`);
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

async function downloadAllHistorical(): Promise<void> {
    Log.info('Syncing candles...');
    // const instruments = await InstrumentService.findTracked();
    // for (const instrument of instruments) {
    //     downloadInstrumentHistorical(instrument);
    // }
}

async function processTicks(ticks: Tick[]): Promise<Candle[]> {
    const tickPipeline = new TickPipeline(ticks);
    const sourceCandles = await tickPipeline.execute();
    const downResPipeline = new DownResPipeline(sourceCandles);
    const downResCandles = await downResPipeline.execute();
    return [...sourceCandles, ...downResCandles];
}

const _tickMap: Record<string, Tick> = {};
let _lastChecked: Date | undefined;

function computeMissingTicks(ticks: Tick[]): Tick[] {
    if (ticks.length === 0) return [];
    if (_lastChecked != undefined && ticks[0].timestamp.getTime() - _lastChecked.getTime() < 10000) return [];
    const tickKeys = Object.keys(_tickMap);
    const missingTicks: Tick[] = [];
    for (const key of tickKeys) {
        const age = ticks[0].timestamp.getTime() - _tickMap[key].timestamp.getTime();
        if (age > 10000) {
            const renewedTick = { ..._tickMap[key], timestamp: new Date(), lastTradeTimestamp: new Date() };
            _tickMap[key] = renewedTick;
            missingTicks.push(renewedTick);
        }
    }
    _lastChecked = new Date();
    return missingTicks;
}

async function bulkConvertTicksToCandles(ticks: Tick[]): Promise<Candle[]> {
    const startTime = Date.now();
    for (const tick of ticks) {
        _tickMap[tick.instrumentId] = tick;
    }
    const missingTicks: Tick[] = computeMissingTicks(ticks);
    const allCandles = await processTicks([...missingTicks, ...ticks]);
    const startWriteTime = Date.now();
    for (const candleChunk of lodash.chunk(allCandles, 100)) {
        await CandleCacheRepository.writeCandles(candleChunk);
    }
    const timeCode = allCandles.length > 0 ? allCandles[0].timeCode : 0;
    const writeTime = Date.now() - startWriteTime;
    const totalTime = Date.now() - startTime;
    const cpuTime = totalTime - writeTime;
    printStats('stats', {
        ticks: ticks.length,
        mapSize: Object.keys(_tickMap).length,
        tickMiss: missingTicks.length,
        candles: allCandles.length,
        writeTime,
        cpuTime,
        totalTime,
        timeCode,
    });
    return allCandles;
}

function parseCandleKey(
    key: string,
): {
    key: string;
    exchange: string;
    tradingSymbol: string;
    interval: string;
    timeCode: string;
    day: string;
    time: string;
} {
    const [exchange, tradingSymbol, interval, timeCode] = key.split(INSTRUMENT_ID_SEPERATOR);
    assertNotUndefined('exchange', exchange);
    assertNotUndefined('tradingSymbol', tradingSymbol);
    assertNotUndefined('interval', interval);
    assertNotUndefined('timeCode', timeCode);
    const day = timeCode.slice(0, 4);
    const time = timeCode.slice(4);
    return { key, exchange, tradingSymbol, interval, timeCode, day, time };
}

function printDiff(name: string, v1: number, v2: number) {
    console.log(
        name.padStart(3, ' '),
        `${v1.toFixed(2)}`.padStart(10, ' '),
        `${v2.toFixed(2)}`.padStart(10, ` `),
        v1 - v2,
    );
}

async function candleDiff(brokerCandle: Candle, databaseCandle: Candle) {
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
    // console.log(brokerCandles.slice(-1).pop());
    // console.log(databaseCandles.slice(-1).pop());
    for (const [i, candle] of candles.entries()) {
        candleDiff(candle, databaseCandles[i]);
    }
}

async function debug(): Promise<void> {
    // const { to } = await getLastTradingDays(5);
    // await InstrumentRepository.findHistoricalNotSynced(to);
    // getAlignedTime({ exchange: 'NSE', interval: CandleInterval.DAY_01, timestamp: new Date() });
}

async function testTickPipeline(): Promise<void> {
    await CandleRepository.flush();
    await CandleCacheRepository.flushCandleCache();
    const instruments = await InstrumentService.findTracked();
    const date = new Date();
    date.setHours(9);
    date.setMinutes(15);
    date.setSeconds(1);
    const { day, time } = toDayAndTime(date);
    const ticks = instruments.map(
        (instrument): Tick => {
            const { tradingSymbol, exchange, id: instrumentId } = instrument;
            return {
                lastTradeTimestamp: date,
                timestamp: date,
                instrumentId,
                exchange,
                tradingSymbol,
                lastTradedPrice: 101.11,
                totalVolume: 100,
                totalBuyQuantity: 0,
                totalSellQuantity: 0,
                time: Number.parseInt(time),
                day: Number.parseInt(day),
                openInterest: 100,
                depth: { buy: [], sell: [] },
            };
        },
    );
    for (const tick of ticks) {
        if (validateTick(tick) === false) throw new Error(JSON.stringify(validateTick.errors, undefined, 2));
    }
    await bulkConvertTicksToCandles(ticks);
    // await bulkConvertTicksToCandles(ticks);
}

export const CandleService = {
    downloadAllHistorical,
    bulkConvertTicksToCandles,
    debug,
    parseCandleKey,
    getAlignedTime,
    getCandleMetaProperties,
    syncHistorical,
    testTickPipeline,
    verifyCandles,
};
