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
import { TickPipeline } from './pipeline';
import { InstrumentRepository } from '../database/repository/instrument';
import { validate } from 'graphql';
import { validateTick } from '../types/tick';
import { SSL_OP_NO_SESSION_RESUMPTION_ON_RENEGOTIATION } from 'constants';
import lodash from 'lodash';

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

async function xdownResCandle(sourceCandle: Candle, interval: CandleInterval): Promise<Candle | undefined> {
    const startTime = new Date();
    try {
        const { exchange, instrumentId } = sourceCandle;
        const timestamp = getAlignedTime({ exchange, timestamp: sourceCandle.timestamp, interval });
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

async function processTicks(ticks: Tick[]): Promise<Candle[]> {
    const pipeline = new TickPipeline(ticks);
    return pipeline.execute();
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
    // await CacheRepository.flushCandles();
    // const candles = await processTicks(ticks);
    // await CacheRepository.writeCandles(candles);
    // console.log('Writing ', candles.length, ' candles.');
    // return candles;
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
