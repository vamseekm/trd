import LRUCache from 'lru-cache';

import { Candle, Instrument } from '../../types';
import { validateCandle } from '../../types/candle';
import { CandleModel } from '../model/candle.table';
import { CandleRepository } from './candle';
import { InstrumentRepository } from './instrument';
import { CacheGroup } from './cache-group';
import { INSTRUMENT_ID_SEPERATOR } from '../../types/instrument';
import { RedisService } from '../../infra/redis';

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
const candleCache = new CacheGroup('candle', true);

async function getCandles(keys: string[]): Promise<Candle[]> {
    const candles = await candleCache.getMulti({ keys }, CandleRepository.getCandle);
    for (const candle of candles) {
        if (candle == undefined) continue;
        if (typeof candle.timestamp === 'string') {
            candle.timestamp = new Date(candle.timestamp);
        }
        candle.volume = Number.parseInt(candle.volume as any);
        if (validateCandle(candle) === false) throw new Error(JSON.stringify(validateCandle.errors, null, 2));
    }
    return candles;
}

async function getCandle(key: string | undefined): Promise<Candle | undefined> {
    if (key == undefined) return;
    const candle: Candle | undefined = await candleCache.get({ key }, async () => {
        return CandleRepository.getCandle(key);
    });
    if (candle == undefined) return candle;
    if (typeof candle.timestamp === 'string') {
        candle.timestamp = new Date(candle.timestamp);
    }
    candle.volume = Number.parseInt(candle.volume as any);
    if (validateCandle(candle) === false) throw new Error(JSON.stringify(validateCandle.errors, null, 2));
    return candle;
}

function candleTimeKeyValue(key: string): { sortedSetKey: string; score: string; value: string } {
    const tokens = key.split(INSTRUMENT_ID_SEPERATOR);
    if (tokens.length != 4) throw new Error(`Invalid candle key format: ${key}`);
    const sortedSetKeySuffix = tokens.slice(0, 3).join(INSTRUMENT_ID_SEPERATOR);
    const value = tokens[3];
    return { sortedSetKey: `tc:${sortedSetKeySuffix}`, score: value, value };
}

async function writeCandleTime(candle?: Candle): Promise<any> {
    if (candle == undefined) return;
    const { key } = candle;
    const { sortedSetKey, score, value } = candleTimeKeyValue(key);
    return RedisService.zadd([sortedSetKey, score, value]);
}

async function setCandle(key: string, candle?: Candle) {
    return Promise.all([writeCandleTime(candle), candleCache.set({ key, value: candle })]);
}

async function writeCandles(candles: Candle[]): Promise<Candle[]> {
    if (candles.length === 0) return candles;
    const candleSavePromises: any = candles.map(async (candle) => {
        return setCandle(candle.key, candle);
    });
    await Promise.all([...candleSavePromises, CandleRepository.upsertCandles(candles)]);
    return candles;
}

async function deleteCandle({ key }: { key: string }): Promise<any> {
    candleCache.del(key);
    return CandleModel.destroy({ where: { key } });
}

async function flushCandles(): Promise<any> {
    candleCache.flush();
}

export const CacheRepository = {
    getInstrumentByToken,
    getInstrumentById,
    setCandle,
    getCandle,
    getCandles,
    writeCandles,
    deleteCandle,
    flushCandles,
};
