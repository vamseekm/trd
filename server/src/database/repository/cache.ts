import LRUCache from 'lru-cache';

import { CandleService } from '../../candle/service';
import { RedisService } from '../../infra/redis';
import { Candle, Instrument } from '../../types';
import { validateCandle } from '../../types/candle';
import { INSTRUMENT_ID_SEPERATOR } from '../../types/instrument';
import { CandleModel } from '../model/candle.table';
import { CacheGroup } from './cache-group';
import { CandleRepository } from './candle';
import { InstrumentRepository } from './instrument';

const INSTRUMENT_CACHE_EXPIRY = 24 * 3600 * 1000;
const INSTRUMENT_COUNT = 5000;
// const instrumentTokenCache = new CacheGroup('ins_token');
const instrumentTokenCache = new LRUCache<string, string>({
    max: INSTRUMENT_COUNT,
    maxAge: INSTRUMENT_CACHE_EXPIRY,
});
async function getInstrumentByToken(instrumentToken: string): Promise<Instrument | undefined> {
    const id = instrumentTokenCache.get(instrumentToken);
    if (id != undefined) return getInstrumentById(id);
    const instrument = await InstrumentRepository.findByInstrumentToken(instrumentToken);
    if (instrument == undefined) return;
    return cacheInstrument(instrument);
}

const instrumentIdCache = new LRUCache<string, Instrument>({ max: INSTRUMENT_COUNT, maxAge: INSTRUMENT_CACHE_EXPIRY });
async function getInstrumentById(id: string): Promise<Instrument | undefined> {
    if (instrumentIdCache.has(id)) return instrumentIdCache.get(id);
    const instrument = await InstrumentRepository.findById(id);
    if (instrument == undefined) return;
    return cacheInstrument(instrument);
}

async function cacheInstrument(instrument: Instrument | null): Promise<Instrument | undefined> {
    if (instrument == undefined) return;
    instrumentTokenCache.set(instrument.instrumentToken, instrument.id);
    instrumentIdCache.set(instrument.id, instrument);
    return instrument;
}

// const candleCache = new LRUCache<string, Candle | undefined>({ max: 20000, maxAge: CANDLE_CACHE_EXPIRY_TIME });
const candleCache = new CacheGroup('C', true);

async function getCandles(keys: string[]): Promise<Candle[]> {
    const candles = await candleCache.getMulti({ keys }, CandleRepository.getCandle);
    for (const [i, candle] of candles.entries()) {
        if (candle == undefined) continue;
        if (typeof candle.timestamp === 'string') {
            candle.timestamp = new Date(candle.timestamp);
        }
        candle.volume = Number.parseInt(candle.volume);
        const { exchange, tradingSymbol, timeCode, interval } = CandleService.parseCandleKey(keys[i]);
        candle.key = keys[i];
        candle.exchange = exchange;
        candle.instrumentId = `${exchange}${INSTRUMENT_ID_SEPERATOR}${tradingSymbol}`;
        candle.interval = interval;
        candle.timeCode = Number.parseInt(timeCode, 10);
        if (validateCandle(candle) === false) throw new Error(JSON.stringify(validateCandle.errors, undefined, 2));
    }
    return candles;
}

async function getCandle(key: string | undefined): Promise<Candle | undefined> {
    if (key == undefined) return;
    return (await getCandles([key]))[0];
}

const CANDLE_TIME_PREFIX = 'CT';

function candleTimeKeyValue(key: string): { sortedSetKey: string; score: string; value: string } {
    const tokens = key.split(INSTRUMENT_ID_SEPERATOR);
    if (tokens.length != 4) throw new Error(`Invalid candle key format: ${key}`);
    const sortedSetKeySuffix = tokens.slice(0, 3).join(INSTRUMENT_ID_SEPERATOR);
    const value = tokens[3];
    return { sortedSetKey: `${CANDLE_TIME_PREFIX}:${sortedSetKeySuffix}`, score: value, value };
}

async function cacheSetCandleTime(candle?: Candle): Promise<any> {
    if (candle == undefined) return;
    const { key } = candle;
    const { sortedSetKey, score, value } = candleTimeKeyValue(key);
    return RedisService.zadd([sortedSetKey, score, value]);
}

async function cacheSetCandle(key: string, candle?: Candle): Promise<any> {
    const cachedValue: any = Object.assign({}, candle);
    if (cachedValue != undefined) {
        delete cachedValue.instrumentId;
        delete cachedValue.exchange;
        delete cachedValue.interval;
        delete cachedValue.timeCode;
        delete cachedValue.key;
    }
    return candleCache.set({ key, value: cachedValue });
}

async function cacheSetCandles(candles: Candle[]): Promise<any> {
    return Promise.all(candles.map((candle) => cacheSetCandle(candle.key, candle)));
}

async function cacheWriteCandles(candles: Candle[]): Promise<Candle[]> {
    if (candles.length === 0) return candles;
    await Promise.all(candles.map((candle) => cacheSetCandle(candle.key, candle)));
    await Promise.all(candles.map((candle) => cacheSetCandleTime(candle)));
    return candles;
}
async function writeCandles(candles: Candle[]): Promise<Candle[]> {
    if (candles.length === 0) return candles;
    await cacheWriteCandles(candles);
    await CandleRepository.upsertCandles(candles);
    return candles;
}

async function deleteCandle({ key }: { key: string }): Promise<any> {
    await candleCache.del(key);
    return CandleModel.destroy({ where: { key } });
}

async function clearCandleTime(): Promise<number> {
    return RedisService.delWithPrefix(`${CANDLE_TIME_PREFIX}:*`);
}

async function flushCandleCache(): Promise<any> {
    return Promise.all([clearCandleTime(), candleCache.flush()]);
}

export const CandleCacheRepository = {
    getInstrumentByToken,
    getInstrumentById,
    cacheSetCandle,
    cacheSetCandles,
    getCandle,
    getCandles,
    writeCandles,
    deleteCandle,
    flushCandleCache,
};
