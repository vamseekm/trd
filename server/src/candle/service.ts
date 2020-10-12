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
import { TickPipeline } from './candle-pipeline';

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

async function mapBrokerCandleToNativeCandle(
    instrument: Instrument,
    interval: CandleInterval,
    candle: IBrokerCandle,
): Promise<Candle | undefined> {
    const { id: instrumentId, exchange } = instrument;
    const { key } = await getCandleMetaProperties({ instrumentId, interval, timestamp: candle.date });
    const { timeCode } = toDayAndTime(candle.date);
    if (key == undefined) return;
    return {
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
let _active = 0;
async function convertTickToCandle(tick: Tick, interval: CandleInterval) {
    // Log.pretty(tick);
    const candleConfig = { ...tick, interval };
    const currentCandleTime = await getAlignedTime(candleConfig);
    const { timeCode } = toDayAndTime(currentCandleTime);
    const { key: currentCandleKey, dayBegin } = await getCandleMetaProperties({
        ...candleConfig,
        timestamp: currentCandleTime,
    });
    if (currentCandleKey == undefined) return;
    const previousCandleTime = await getAlignedTime({ ...candleConfig, offset: -1 });
    const { key: previousCandleKey } = await getCandleMetaProperties({
        ...candleConfig,
        timestamp: previousCandleTime,
    });
    Log.info(currentCandleKey);
    console.time(currentCandleKey);
    _active += 1;
    const [previousCandle, currentCandle] = await Promise.all([
        CacheRepository.getCandle(previousCandleKey),
        CacheRepository.getCandle(currentCandleKey),
    ]);

    const { instrumentId, exchange } = tick;
    const updatedCandle: Candle = {
        instrumentId,
        exchange,
        interval,
        timeCode,
        key: currentCandleKey,
        timestamp: currentCandleTime,
        open: currentCandle?.open || tick.lastTradedPrice,
        high: Math.max(currentCandle?.high || tick.lastTradedPrice, tick.lastTradedPrice),
        low: Math.min(currentCandle?.low || tick.lastTradedPrice, tick.lastTradedPrice),
        close: tick.lastTradedPrice,
        volume: tick.totalVolume,
        totalVolume: tick.totalVolume,
        totalOpenInterest: tick.openInterest,
        openInterest: tick.openInterest,
    };
    if (dayBegin === false && previousCandle != undefined) {
        updatedCandle.volume = updatedCandle.totalVolume - previousCandle.totalVolume;
        updatedCandle.openInterest = updatedCandle.totalOpenInterest - previousCandle.totalOpenInterest;
    }
    _active -= 1;
    Log.info('End:', `${_active}`);
    console.timeEnd(currentCandleKey);

    return updatedCandle;
}
const _intervals = [
    CandleInterval.MIN_05,
    CandleInterval.MIN_10,
    CandleInterval.MIN_15,
    CandleInterval.MIN_30,
    CandleInterval.MIN_60,
    // CandleInterval.DAY_01,
];

async function downResCandle(sourceCandle: Candle, interval: CandleInterval): Promise<Candle | undefined> {
    const startTime = new Date();
    try {
        const { exchange, instrumentId } = sourceCandle;
        const timestamp = await getAlignedTime({ exchange, timestamp: sourceCandle.timestamp, interval });
        const { key: currentCandleKey, dayBegin } = await getCandleMetaProperties({
            instrumentId,
            interval,
            timestamp,
        });
        const { timeCode } = toDayAndTime(timestamp);
        const { key: previousCandleKey } = await getCandleMetaProperties({
            instrumentId,
            interval,
            timestamp: await getAlignedTime({ exchange, timestamp: sourceCandle.timestamp, interval, offset: -1 }),
        });

        const [currentCandle, previousCandle] = await Promise.all([
            CacheRepository.getCandle(currentCandleKey),
            CacheRepository.getCandle(previousCandleKey),
        ]);
        const atBegin = timeCode === sourceCandle.timeCode;
        const updatedCandle: Candle = {
            key: currentCandleKey,
            exchange,
            instrumentId,
            timeCode,
            interval,
            timestamp,
            open: atBegin ? sourceCandle.open : currentCandle?.open || sourceCandle.open,
            high: Math.max(sourceCandle.high, currentCandle?.high || sourceCandle.high),
            low: Math.min(sourceCandle.low, currentCandle?.low || sourceCandle.low),
            close: sourceCandle.close,
            volume: sourceCandle.totalVolume,
            openInterest: sourceCandle.totalOpenInterest,
            totalVolume: sourceCandle.totalVolume,
            totalOpenInterest: sourceCandle.totalOpenInterest,
        };
        if (dayBegin === false && previousCandle != undefined) {
            updatedCandle.volume = updatedCandle.totalVolume - previousCandle.totalVolume;
            updatedCandle.openInterest = updatedCandle.totalVolume - previousCandle.totalVolume;
        }
        if (currentCandle == undefined) return updatedCandle;
        const keys = Object.keys(updatedCandle);
        for (const key of keys) {
            if (key === 'timestamp') continue;
            if ((currentCandle as any)[key] !== (updatedCandle as any)[key]) return updatedCandle;
        }
    } finally {
    }
}

async function oldProcessTick(tick: Tick): Promise<Candle[]> {
    const allCandles: Candle[] = [];
    const candle = await convertTickToCandle(tick, CandleInterval.MIN_01);
    if (candle == undefined) return allCandles;
    allCandles.push(candle);
    // await Promise.all(
    //     _intervals.map(async (interval) => {
    //         const dcandle = await downResCandle(candle, interval);
    //         if (dcandle == undefined) return;
    //         allCandles.push(dcandle);
    //     }),
    // );
    // for (const interval of _intervals) {
    //     const dcandle = await downResCandle(candle, interval);
    //     if (dcandle == undefined) continue;
    //     allCandles.push(dcandle);
    // }
    return allCandles;
}

async function oldProcessTicks(ticks: Tick[]): Promise<Candle[]> {
    const allCandles: Candle[] = [];
    await Promise.all(
        ticks.map(async (tick) => {
            const candles = await oldProcessTick(tick);
            candles.forEach((candle) => allCandles.push(candle));
        }),
    );
    return allCandles;
}

async function convertTicksToCandles(ticks: Tick[]) {}

async function processTicks(ticks: Tick[]): Promise<Candle[]> {
    ExchangeService.getAllExchangeTimes();
    ExchangeService.getAllExchangeTimes();
    ExchangeService.getAllExchangeTimes();
    const iterCount = 1;
    console.time('processTicks');
    for (let i = 0; i < iterCount; i++) {
        await new TickPipeline(ticks).execute();
    }
    console.timeEnd('processTicks');
    console.log(iterCount);
    return [];
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
    await CacheRepository.flushCandles();
    await processTicks(ticks);
    return [];
    // const startTime = Date.now();
    // for (const tick of ticks) {
    //     _tickMap[tick.instrumentId] = tick;
    // }
    // const missingTicks: Tick[] = computeMissingTicks(ticks);
    // const processTicksStart = Date.now();
    // const allCandles = await oldProcessTicks([...missingTicks, ...ticks]);
    // const candleMap = new Map<string, Candle>();
    // allCandles.forEach((candle) => candleMap.set(candle.key, candle));
    // const uniqueCandles = [...candleMap.values()];
    // const startWriteTime = Date.now();
    // const processTime = Date.now() - startTime;
    // await CacheRepository.writeCandles(uniqueCandles);
    // const timeCode = uniqueCandles.length > 0 ? uniqueCandles[0].timeCode : 0;
    // printStats('stats', {
    //     ticks: ticks.length,
    //     mapSize: Object.keys(_tickMap).length,
    //     cacheMiss: missingTicks.length,
    //     candles: allCandles.length,
    //     flushTime: Date.now() - startWriteTime,
    //     processTicksTime: Date.now() - processTicksStart,
    //     totalTime: Date.now() - startTime,
    //     timeCode,
    // });
    // return uniqueCandles;
}

async function parseCandleKey({
    key,
}: {
    key: string;
}): Promise<{ key: string; exchange: string; tradingSymbol: string; interval: string; time: string }> {
    const [exchange, tradingSymbol, interval, time] = key.split(INSTRUMENT_ID_SEPERATOR);
    return { key, exchange, tradingSymbol, interval, time };
}
async function candleDiff(brokerCandle: IBrokerCandle, databaseCandle: IBrokerCandle) {
    console.log(brokerCandle.date.toLocaleString(), databaseCandle.date.toLocaleString());
    console.log(brokerCandle.open - databaseCandle.open);
    console.log(brokerCandle.high - databaseCandle.high);
    console.log(brokerCandle.low - databaseCandle.low);
    console.log(brokerCandle.close - databaseCandle.close);
    console.log(brokerCandle.volume - databaseCandle.volume);
}
async function verifyCandles(): Promise<void> {
    const from = DateTime.local(2020, 10, 8, 0, 0, 0).toJSDate();
    const to = DateTime.fromJSDate(from).plus({ day: 1 }).toJSDate();
    const searchOptions = {
        id: 'NFO:NIFTY20OCTFUT',
        interval: CandleInterval.MIN_05,
        from,
        to,
    };
    const databaseCandles = await CandleRepository.findBy(searchOptions);
    const brokerCandles = await BrokerService.getHistorical(searchOptions);
    console.log(brokerCandles.length, databaseCandles.length);
    // console.log(brokerCandles.slice(-1).pop());
    // console.log(databaseCandles.slice(-1).pop());
    const brokerCandle = brokerCandles.slice(-1).pop();
    const databaseCandle = databaseCandles.slice(-1).pop();
    if (brokerCandle && databaseCandle) {
        await candleDiff(brokerCandle, { ...databaseCandle, date: databaseCandle.timestamp });
        console.log(brokerCandle.date.toLocaleString());
        console.log(brokerCandle.volume, databaseCandle.volume);
        console.log(databaseCandle.totalVolume);
    }
}

async function debug(): Promise<void> {
    while (true) {
        await verifyCandles();
        await sleep(5000);
    }
}

export const CandleService = {
    downloadHistorical: bulkDownloadHistorical,
    bulkConvertTicksToCandles,
    debug,
    parseCandleKey,
    getAlignedTime,
    getCandleMetaProperties,
};
