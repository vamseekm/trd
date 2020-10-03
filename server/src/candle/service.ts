import { timeStamp } from 'console';
import { DateTime } from 'luxon';
import { start } from 'repl';
import { updateComputedPropertyName } from 'typescript';

import { BrokerService } from '../broker';
import { CacheRepository } from '../database';
import { CandleRepository } from '../database/repository/candle';
import { InstrumentRepository } from '../database/repository/instrument';
import { ExchangeService } from '../exchange';
import { Log } from '../infra';
import { InstrumentService } from '../instrument';
import { Candle, CandleDuration, CandleInterval, IBrokerCandle, Instrument, Tick } from '../types';
import { INSTRUMENT_ID_SEPERATOR } from '../types';
import { IExchangeTImeProperties } from '../types/exchange';
import { sleep, toDayAndTime } from '../util';

async function getCandleMetaProperties({
    instrumentId,
    interval,
    timestamp,
}: {
    instrumentId: string;
    interval: CandleInterval | string;
    timestamp: Date;
}): Promise<{ key: string } & IExchangeTImeProperties> {
    const [exchange] = instrumentId.split(INSTRUMENT_ID_SEPERATOR);
    const { day, time } = await toDayAndTime(timestamp);
    const separator = INSTRUMENT_ID_SEPERATOR;
    const properties = await ExchangeService.exchangeTimeProps({ exchange, timestamp });
    return {
        key: `${instrumentId}${separator}${interval}${separator}${day}${time}`,
        ...properties,
    };
}

async function getAlignedTime({
    exchange,
    timestamp,
    interval,
    offset = 0,
}: {
    exchange: string;
    timestamp: Date;
    interval: CandleInterval | string;
    offset?: number;
}): Promise<Date> {
    const exchangeConfig = await ExchangeService.getExchangeTime(exchange);
    const unixTime = timestamp.getTime() - exchangeConfig.dayStartOffset;
    const intervalInMs = CandleDuration[interval as CandleInterval] * 1000;
    const alignedTime = unixTime - (unixTime % intervalInMs) + intervalInMs * offset + exchangeConfig.dayStartOffset;
    return new Date(alignedTime);
}

async function splitCandleKey(key: string) {
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
    const { timeCode } = await toDayAndTime(candle.date);
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
        const { exchange } = await splitCandleKey(nativeCandle.key);
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
    const candles = await await downloadCandles({ instrument: instrument, interval: CandleInterval.MIN_01, from, to });
    for (const candle of candles) {
        await writeHistoricalCandle(candle);
    }
}

async function bulkDownloadHistorical(): Promise<void> {
    Log.info('Syncing candles...');
    const instruments = await InstrumentService.findTracked();
    for (const instrument of instruments) {
        await downloadHistorical(instrument);
        await sleep(300);
    }
}

async function convertTickToCandle(tick: Tick, interval: CandleInterval) {
    // Log.pretty(tick);
    const candleConfig = { ...tick, interval };
    const currentCandleTime = await getAlignedTime(candleConfig);
    const { timeCode } = await toDayAndTime(currentCandleTime);
    const { key: currentCandleKey, dayBegin } = await getCandleMetaProperties({
        ...candleConfig,
        timestamp: currentCandleTime,
    });
    if (currentCandleKey == undefined) return;
    const currentCandle = await CacheRepository.getCandle(currentCandleKey);
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
    const previousCandleTime = await getAlignedTime({ ...candleConfig, offset: -1 });
    const { key: previousCandleKey } = await getCandleMetaProperties({
        ...candleConfig,
        timestamp: previousCandleTime,
    });

    const previousCandle = await CacheRepository.getCandle(previousCandleKey);
    if (dayBegin === false && previousCandle != undefined) {
        updatedCandle.volume = updatedCandle.totalVolume - previousCandle.totalVolume;
        updatedCandle.openInterest = updatedCandle.totalOpenInterest - previousCandle.totalOpenInterest;
    }
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
        const { timeCode } = await toDayAndTime(timestamp);
        const currentCandle = await CacheRepository.getCandle(currentCandleKey);
        const { key: previousCandleKey } = await getCandleMetaProperties({
            instrumentId,
            interval,
            timestamp: await getAlignedTime({ exchange, timestamp: sourceCandle.timestamp, interval, offset: -1 }),
        });
        const previousCandle = await CacheRepository.getCandle(previousCandleKey);
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
        const diff = new Date().getTime() - startTime.getTime();
    }
}

async function processTicks(ticks: Tick[]): Promise<Candle[]> {
    const allCandles: Candle[] = [];
    for (const tick of ticks) {
        const candle = await convertTickToCandle(tick, CandleInterval.MIN_01);
        if (candle == undefined) continue;
        allCandles.push(candle);
        for (const interval of _intervals) {
            const dcandle = await downResCandle(candle, interval);
            if (dcandle == undefined) continue;
            allCandles.push(dcandle);
        }
    }
    return allCandles;
}

const _tickMap: Record<string, Tick> = {};
let _lastChecked: Date | undefined;

async function computeMissingTicks(ticks: Tick[]): Promise<Tick[]> {
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
    const startTime = new Date();
    for (const tick of ticks) {
        _tickMap[tick.instrumentId] = tick;
    }
    const missingTicks: Tick[] = await computeMissingTicks(ticks);
    const allCandles = await processTicks([...ticks, ...missingTicks]);
    const candleMap = new Map<string, Candle>();
    allCandles.forEach((candle) => candleMap.set(candle.key, candle));
    const uniqueCandles = [...candleMap.values()];
    const startWriteTime = new Date();
    await CacheRepository.writeCandles(uniqueCandles);
    const timeCode = uniqueCandles.length > 0 ? uniqueCandles[0].timeCode : 0;
    Log.json('stats', {
        ticks: ticks.length,
        mapSize: Object.keys(_tickMap).length,
        missingTicks: missingTicks.length,
        candles: allCandles.length,
        writeTime: new Date().getTime() - startWriteTime.getTime(),
        time: new Date().getTime() - startTime.getTime(),
        timeCode,
    });
    return uniqueCandles;
}

async function parseCandleKey({ key }: { key: string }) {
    const [exchange, tradingSymbol, interval, time] = key.split(INSTRUMENT_ID_SEPERATOR);
    return { key, exchange, tradingSymbol, interval, time };
}

async function verifyCandles(): Promise<void> {
    const from = DateTime.local(2020, 10, 1, 0, 0, 0).toJSDate();
    const to = DateTime.fromJSDate(from).plus({ day: 1 }).toJSDate();
    const searchOptions = {
        id: 'NFO:NIFTY20OCTFUT',
        interval: CandleInterval.MIN_01,
        from,
        to,
    };
    const databaseCandles = await CandleRepository.findBy(searchOptions);
    const brokerCandles = await BrokerService.getHistorical(searchOptions);
}

async function debug(): Promise<void> {
    await verifyCandles();
}

export const CandleService = {
    downloadHistorical: bulkDownloadHistorical,
    bulkConvertTicksToCandles,
    debug,
    parseCandleKey,
};
