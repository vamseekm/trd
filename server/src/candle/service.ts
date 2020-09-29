import { EHOSTUNREACH } from 'constants';
import { DateTime } from 'luxon';
import pFilter from 'p-filter';
import pMap from 'p-map';

import { BrokerService } from '../broker';
import { CandleRepository } from '../database';
import { CacheRepository } from '../database';
import { ExchangeService } from '../exchange';
import { Log } from '../infra';
import { InstrumentService } from '../instrument';
import { Candle, CandleDuration, CandleInterval, IBrokerCandle, Instrument, Tick } from '../types';
import { INSTRUMENT_ID_SEPERATOR } from '../types';
import { sleep, toDayAndTime } from '../util';

async function candleKey({
    instrumentId,
    interval,
    timestamp,
}: {
    instrumentId: string;
    interval: CandleInterval;
    timestamp: Date;
}): Promise<string | undefined> {
    // if (instrumentId.indexOf('_') >= 0) throw new Error(`Invalid ${instrumentId}`);
    const [exchange, ...rest] = instrumentId.split(INSTRUMENT_ID_SEPERATOR);
    if (!ExchangeService.isValidTime({ date: timestamp, exchange })) {
        console.log('Invalid key');
        return;
    }
    const { day, time } = await toDayAndTime(timestamp);
    const separator = INSTRUMENT_ID_SEPERATOR;
    return `${instrumentId}${separator}${interval}${separator}${day}${time}`;
}

async function getAlignedTime({
    exchange,
    timestamp,
    interval,
    offset = 0,
}: {
    exchange: string;
    timestamp: Date;
    interval: CandleInterval;
    offset?: number;
}): Promise<Date> {
    const exchangeConfig = await ExchangeService.getExchangeTime(exchange);
    const unixTime = timestamp.getTime() - exchangeConfig.dayStartOffset;
    const intervalInMs = CandleDuration[interval] * 1000;
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
    const { id } = instrument;
    const key = await candleKey({ instrumentId: id, interval, timestamp: candle.date });
    if (key == undefined) return;
    return {
        key,
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
    const { instrumentToken } = instrument;
    const rawCandles = await BrokerService.getHistorical({ instrumentToken, interval, from, to });
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

async function downloadHistorical(): Promise<void> {
    Log.info('Syncing candles...');
    const instruments = await InstrumentService.findTracked();
    for (const instrument of instruments) {
        const { id } = instrument;
        Log.info(`Candle sync: ${id}`);
        const to = new Date();
        const from = DateTime.local().minus({ day: 7 }).toJSDate();
        const candles = await downloadCandles({ instrument: instrument, interval: CandleInterval.MIN_01, from, to });

        if (candles.length > 0) await CandleRepository.upsertCandles(candles);
        await sleep(300);
    }
}

async function convertTickToCandle(tick: Tick, interval: CandleInterval) {
    // Log.pretty(tick);
    const candleConfig = { ...tick, interval };
    const currentCandleTime = await getAlignedTime(candleConfig);
    const currentCandleKey = await candleKey({ ...candleConfig, timestamp: currentCandleTime });
    if (currentCandleKey == undefined) return;
    let currentCandle = await CacheRepository.getCandle(currentCandleKey);
    //TODO: Validate candle read from cache as the timestamp is string instead of Date.
    if (currentCandle == undefined) {
        currentCandle = {
            key: currentCandleKey,
            timestamp: currentCandleTime,
            open: tick.lastTradedPrice,
            high: tick.lastTradedPrice,
            low: tick.lastTradedPrice,
            close: tick.lastTradedPrice,
            volume: tick.totalVolume,
            totalVolume: tick.totalVolume,
            totalOpenInterest: tick.openInterest,
            openInterest: tick.openInterest,
        };
    } else {
        currentCandle.timestamp = currentCandleTime;
        currentCandle.high = Math.max(currentCandle.high, tick.lastTradedPrice);
        currentCandle.low = Math.min(currentCandle.low, tick.lastTradedPrice);
        currentCandle.close = tick.lastTradedPrice;
        currentCandle.volume = currentCandle.totalVolume = tick.totalVolume;
        currentCandle.openInterest = currentCandle.totalOpenInterest = tick.openInterest;
    }
    const previousCandleTime = await getAlignedTime({ ...candleConfig, offset: -1 });
    const previousCandleKey = await candleKey({
        ...candleConfig,
        timestamp: previousCandleTime,
    });
    const previousCandle = await CacheRepository.getCandle(previousCandleKey);
    if (previousCandle != undefined) {
        currentCandle.volume = currentCandle.totalVolume - previousCandle.totalVolume;
        currentCandle.openInterest = currentCandle.totalOpenInterest - previousCandle.totalOpenInterest;
    }
    // console.timeEnd('tick-prep');
    return currentCandle;
}
const _intervals = [
    CandleInterval.MIN_05,
    CandleInterval.MIN_10,
    CandleInterval.MIN_15,
    CandleInterval.MIN_30,
    CandleInterval.MIN_60,
    CandleInterval.DAY_01,
];

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
async function bulkConvertTicksToCandles(ticks: Tick[]): Promise<Candle[]> {
    const startTime = new Date();
    for (const tick of ticks) {
        _tickMap[tick.instrumentId] = tick;
    }
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
    const allCandles = await processTicks([...ticks, ...missingTicks]);
    Log.json('stats', {
        ticks: ticks.length,
        missingTicks: missingTicks.length,
        candles: allCandles.length,
        time: new Date().getTime() - startTime.getTime(),
    });
    const candles = await CacheRepository.writeCandles(allCandles);
    return candles;
}

async function parseCandleKey({ key }: { key: string }) {
    const [exchange, tradingSymbol, interval, time] = key.split(INSTRUMENT_ID_SEPERATOR);
    const ret = { key, exchange, tradingSymbol, interval, time };
    return ret;
}

async function downResCandle(sourceCandle: Candle, newInterval: CandleInterval) {
    const { exchange, tradingSymbol, interval } = await parseCandleKey(sourceCandle);
    if (interval !== CandleInterval.MIN_01) throw new Error(`Wrong interval ${interval} in ${sourceCandle.key}`);
    const instrumentId = `${exchange}${INSTRUMENT_ID_SEPERATOR}${tradingSymbol}`;
    const candleConfig = { ...sourceCandle, interval: newInterval, exchange };
    const currentCandleTime = await getAlignedTime(candleConfig);
    const currentCandleKey = await candleKey({ ...candleConfig, timestamp: currentCandleTime, instrumentId });
    if (currentCandleKey == undefined) return;
    const previousCandleTime = await getAlignedTime({ ...candleConfig, offset: -1 });
    const previousCandleKey = await candleKey({
        ...candleConfig,
        instrumentId,
        timestamp: previousCandleTime,
    });
    let [currentCandle, previousCandle] = await Promise.all([
        CacheRepository.getCandle(currentCandleKey),
        CacheRepository.getCandle(previousCandleKey),
    ]);
    const { close: sourceClose, volume, totalVolume, openInterest, totalOpenInterest } = sourceCandle;
    const updatedCandle: Candle = {
        key: currentCandleKey,
        timestamp: currentCandleTime,
        open: currentCandle?.open || sourceCandle.open,
        high: Math.max(currentCandle?.high || sourceClose, sourceCandle.high),
        low: Math.min(currentCandle?.low || sourceClose, sourceCandle.low),
        close: sourceClose,
        volume: Math.max(volume, currentCandle?.volume || volume),
        totalVolume: Math.max(totalVolume, currentCandle?.totalVolume || totalVolume),
        openInterest: Math.max(openInterest, currentCandle?.openInterest || openInterest),
        totalOpenInterest: Math.max(totalOpenInterest, sourceCandle?.totalOpenInterest || totalOpenInterest),
    };
    if (previousCandle != undefined) {
        updatedCandle.volume = updatedCandle.totalVolume - previousCandle.totalVolume;
        updatedCandle.openInterest = updatedCandle.totalOpenInterest - previousCandle.totalOpenInterest;
    }
    if (currentCandle == undefined) return updatedCandle;
    const keys = Object.keys(currentCandle);
    for (const key of keys) {
        const val1 = (currentCandle as any)[key];
        const val2 = (updatedCandle as any)[key];
        if (val1.getMonth && val2.getMonth) {
            if (val1.getTime() !== val2.getTime()) return updatedCandle;
            continue;
        }
        if (val1 !== val2) {
            return updatedCandle;
        }
    }
}

async function batchDownResCandles(candle: Candle): Promise<Candle[]> {
    const candles = await Promise.all([
        downResCandle(candle, CandleInterval.MIN_05),
        downResCandle(candle, CandleInterval.MIN_10),
        downResCandle(candle, CandleInterval.MIN_15),
        downResCandle(candle, CandleInterval.MIN_30),
        downResCandle(candle, CandleInterval.MIN_60),
        downResCandle(candle, CandleInterval.DAY_01),
    ]);
    return candles.filter((candle) => candle != undefined) as Candle[];
}

async function debug(): Promise<void> {
    await CacheRepository.flushCandles();
    // const instruments = await BrokerService.getInstrumentsByExchange('NSE');
    // console.log(instruments);
    // const candles = await CandleRepository.findBy({ id: 'NFO:NIFTY20OCTFUT' });
    // for (const candle of candles) {
    //     console.log(await CacheRepository.deleteCandle(candle));
    //     // const downCandles = await batchDownResCandles(candle);
    //     // await CacheRepository.writeCandles(downCandles);
    // }
    // console.log(candles);
}

export const CandleService = {
    downloadHistorical,
    bulkConvertTicksToCandles,
    debug,
    parseCandleKey,
};
