import { DateTime } from 'luxon';

import { BrokerService } from '../broker';
import { CacheRepository, CandleRepository } from '../database';
import { ExchangeService } from '../exchange';
import { Log } from '../infra';
import { InstrumentService } from '../instrument';
import { Candle, CandleDuration, CandleInterval, IBrokerCandle, Instrument, Tick } from '../types';
import { INSTRUMENT_ID_SEPERATOR } from '../types';
import { validateCandle } from '../types/candle';
import { IExchangeTImeProperties } from '../types/exchange';
import { printStats, sleep, toDayAndTime } from '../util';
import { TickPipeline } from './tick-pipeline';
import { InstrumentRepository } from '../database/repository/instrument';
import { validate } from 'graphql';
import { validateTick } from '../types/tick';
import { SSL_OP_NO_SESSION_RESUMPTION_ON_RENEGOTIATION } from 'constants';
import lodash from 'lodash';
import { DownResPipeline } from './downres-pipeline';

function getCandleMetaProperties({
    instrumentId,
    interval,
    timestamp,
}: {
    instrumentId: string;
    interval: CandleInterval | string;
    timestamp: Date;
}): { key: string } & IExchangeTImeProperties {
    const separator = INSTRUMENT_ID_SEPERATOR;
    const [exchange] = instrumentId.split(separator);
    const { day, time } = toDayAndTime(timestamp);
    const result = {
        key: `${instrumentId}${separator}${interval}${separator}${day}${time}`,
    };
    Object.assign(result, ExchangeService.exchangeTimeProps({ exchange, timestamp }));
    return result as any;
    // const properties = ExchangeService.exchangeTimeProps({ exchange, timestamp });

    // return {
    //     ...properties,
    // };
}

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
    const unixTime = timestamp.getTime() - exchangeConfig.dayStartOffset;
    const intervalInMs = CandleDuration[interval as CandleInterval] * 1000;
    const alignedTime = unixTime - (unixTime % intervalInMs) + intervalInMs * offset + exchangeConfig.dayStartOffset;
    return new Date(alignedTime);
}

function splitCandleKey(key: string) {
    const [exchange, tradingSymbol, period, time] = key.split('-');
    return {
        exchange,
        tradingSymbol,
        period,
        time,
    };
}

function mapBrokerCandleToNativeCandle(
    instrument: Instrument,
    interval: CandleInterval,
    candle: IBrokerCandle,
): Candle | undefined {
    const { id: instrumentId, exchange } = instrument;
    const { key } = getCandleMetaProperties({ instrumentId, interval, timestamp: candle.date });
    const { timeCode } = toDayAndTime(candle.date);
    if (key == undefined) return;
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
    return nativeCandle;
}

function mapBrokerCandlesToNaiveCandles(
    instrument: Instrument,
    interval: CandleInterval,
    candles: IBrokerCandle[],
): Candle[] {
    return candles
        .map((candle) => mapBrokerCandleToNativeCandle(instrument, interval, candle))
        .filter((candle) => candle != undefined) as Candle[];
}

async function downloadCandles({
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
    const { instrumentToken: id } = instrument;
    const rawCandles = await BrokerService.getHistorical({ id, interval, from, to });
    const processedCandles = [];
    for (const candle of rawCandles) {
        const nativeCandle = await mapBrokerCandleToNativeCandle(instrument, interval, candle);
        if (nativeCandle == undefined) continue;
        const { exchange } = splitCandleKey(nativeCandle.key);
        const { timestamp } = nativeCandle;
        if ((await ExchangeService.isValidTime({ exchange, date: timestamp })) === true)
            processedCandles.push(nativeCandle);
    }
    return processedCandles;
}
async function getPreviousCandle(candle: Candle): Promise<Candle | undefined> {
    const instrument = await CacheRepository.getInstrumentById(candle.instrumentId);
    if (instrument == undefined) return;
    const { exchange, instrumentId, interval, timestamp } = candle;
    const previousCandleTime = await getAlignedTime({
        exchange,
        timestamp,
        interval: interval as CandleInterval,
        offset: -1,
    });
    const { key: previousCandleKey } = await getCandleMetaProperties({
        instrumentId,
        interval: interval as CandleInterval,
        timestamp: previousCandleTime,
    });
    return CacheRepository.getCandle(previousCandleKey);
}

async function writeHistoricalCandle(inputCandle: Candle): Promise<Candle[]> {
    const previousCandle = await getPreviousCandle(inputCandle);
    const { dayBegin } = await getCandleMetaProperties(inputCandle);
    if (dayBegin) {
        inputCandle.totalVolume = inputCandle.volume;
        inputCandle.totalOpenInterest = inputCandle.openInterest;
    } else if (previousCandle != undefined) {
        inputCandle.totalVolume += previousCandle.totalVolume + inputCandle.volume;
        inputCandle.totalOpenInterest += previousCandle.totalOpenInterest + inputCandle.openInterest;
    }
    return CacheRepository.writeCandles([inputCandle]);
}

async function downloadHistorical(instrument: Instrument): Promise<void> {
    const { id } = instrument;
    Log.info(`Candle sync: ${id}`);
    const to = new Date();
    const from = DateTime.local().minus({ day: 1 }).toJSDate();
    const candles = await downloadCandles({ instrument: instrument, interval: CandleInterval.MIN_01, from, to });
    for (const candle of candles) await writeHistoricalCandle(candle);
}

async function bulkDownloadHistorical(): Promise<void> {
    Log.info('Syncing candles...');
    const instruments = await InstrumentService.findTracked();
    for (const instrument of instruments) {
        await downloadHistorical(instrument);
        await sleep(300);
    }
}

const _intervals = [
    CandleInterval.MIN_05,
    CandleInterval.MIN_10,
    CandleInterval.MIN_15,
    CandleInterval.MIN_30,
    CandleInterval.MIN_60,
    // CandleInterval.DAY_01,
];

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
        await CacheRepository.writeCandles(candleChunk);
    }
    const timeCode = allCandles.length > 0 ? allCandles[0].timeCode : 0;
    printStats('stats', {
        ticks: ticks.length,
        mapSize: Object.keys(_tickMap).length,
        cacheMiss: missingTicks.length,
        candles: allCandles.length,
        flushTime: Date.now() - startWriteTime,
        totalTime: Date.now() - startTime,
        timeCode,
    });
    return allCandles;
}

function parseCandleKey({
    key,
}: {
    key: string;
}): { key: string; exchange: string; tradingSymbol: string; interval: string; time: string } {
    const [exchange, tradingSymbol, interval, time] = key.split(INSTRUMENT_ID_SEPERATOR);
    return { key, exchange, tradingSymbol, interval, time };
}

function printDiff(name: string, v1: number, v2: number) {
    console.log(name, `${v1.toFixed(2)}`.padStart(10, ' '), `${v2.toFixed(2)}`.padStart(10, ` `), v1 - v2);
}

async function candleDiff(brokerCandle: Candle, databaseCandle: Candle) {
    printDiff('T', brokerCandle.timeCode, databaseCandle.timeCode);
    printDiff('O', brokerCandle.open, brokerCandle.open);
    printDiff('H', brokerCandle.high, brokerCandle.high);
    printDiff('L', brokerCandle.low, brokerCandle.low);
    printDiff('C', brokerCandle.close, brokerCandle.close);
    printDiff('V', brokerCandle.volume, brokerCandle.volume);
}

async function verifyCandles(): Promise<void> {
    const from = DateTime.local(2020, 10, 13, 0, 0, 0).toJSDate();
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
    const brokerCandles = mapBrokerCandlesToNaiveCandles(
        instrument,
        searchOptions.interval,
        await BrokerService.getHistorical(searchOptions),
    );

    console.log('total candles:', brokerCandles.length, databaseCandles.length);
    // console.log(brokerCandles.slice(-1).pop());
    // console.log(databaseCandles.slice(-1).pop());
    for (const [i, brokerCandle] of brokerCandles.entries()) {
        candleDiff(brokerCandle, databaseCandles[i]);
    }
}

async function debug(): Promise<void> {
    await verifyCandles();
    await sleep(5000);
}

async function testTickPipeline(): Promise<void> {
    await CandleRepository.flush();
    await CacheRepository.flushCandles();
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
    downloadHistorical: bulkDownloadHistorical,
    bulkConvertTicksToCandles,
    debug,
    parseCandleKey,
    getAlignedTime,
    getCandleMetaProperties,
    testTickPipeline,
};
