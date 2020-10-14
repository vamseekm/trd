import LRUCache from 'lru-cache';

import { Candle, Instrument } from '../../types';
import { validateCandle } from '../../types/candle';
import { CandleModel } from '../model/candle.table';
import { CandleRepository } from './candle';
import { InstrumentRepository } from './instrument';
import { CacheGroup } from './cache-group';

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
    // missMap[key] = missMap[key] || 0;
    // missMap[key] += 1;
    // if (missMap[key] > 3) {
    //     console.log('Miss:', missMap[key], key);
    //     console.log('Miss:', candle);
    // }
    if (candle == undefined) return candle;
    if (typeof candle.timestamp === 'string') {
        candle.timestamp = new Date(candle.timestamp);
    }
    candle.volume = Number.parseInt(candle.volume as any);
    if (validateCandle(candle) === false) throw new Error(JSON.stringify(validateCandle.errors, null, 2));
    return candle;
    // return setCandle(key, candle);
}

async function setCandle(key: string, candle?: Candle) {
    await candleCache.set({ key, value: candle });
    return candle;
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
