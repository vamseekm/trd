import { Candle, Instrument } from '../../types';
import { CacheGroup } from './cache-group';
import { CandleRepository } from './candle';
import { InstrumentRepository } from './instrument';
import { validateCandle } from '../../types/candle';

const INSTRUMENT_CACHE_EXPIRY = 24 * 3600 * 1000;
const instrumentTokenCache = new CacheGroup('ins_token');
async function getInstrumentByToken(instrumentToken: string): Promise<Instrument | undefined> {
    return instrumentTokenCache.get({ key: `${instrumentToken}`, expiry: INSTRUMENT_CACHE_EXPIRY }, async () => {
        return cacheInstrument(await InstrumentRepository.findByInstrumentToken(instrumentToken));
    });
}
const instrumentIdCache = new CacheGroup('ins_id');
async function getInstrumentById(id: string): Promise<Instrument | undefined> {
    return instrumentIdCache.get({ key: id, expiry: INSTRUMENT_CACHE_EXPIRY }, async () => {
        console.log('miss:', id);
        return cacheInstrument(await InstrumentRepository.findById(id));
    });
}
async function cacheInstrument(instrument: Instrument | null): Promise<Instrument | undefined> {
    if (instrument == undefined) return;
    await instrumentIdCache.set({ key: instrument.id, value: instrument, expiry: INSTRUMENT_CACHE_EXPIRY });
    await instrumentTokenCache.set({
        key: `${instrument.instrumentToken}`,
        value: instrument,
        expiry: INSTRUMENT_CACHE_EXPIRY,
    });
    return instrument;
}

const CANDLE_CACHE_EXPIRY_TIME = 24 * 3600 * 1000;
const candleCache = new CacheGroup('candle');
async function getCandle(key: string): Promise<Candle | undefined> {
    const candle = await candleCache.get({ key, expiry: CANDLE_CACHE_EXPIRY_TIME }, async () => {
        return CandleRepository.getCandle(key);
    });
    if (candle == undefined) return;
    candle.volume = Number.parseInt(candle.volume);
    if (typeof candle.timestamp === 'string') {
        candle.timestamp = new Date(candle.timestamp);
    }
    if (validateCandle(candle) === false) throw new Error(JSON.stringify(validateCandle.errors, null, 2));
    return candle;
}

async function writeCandles(candles: Candle[]): Promise<Candle[]> {
    const list: any = candles.map(async (candle) => {
        return candleCache.set({ key: candle.key, expiry: CANDLE_CACHE_EXPIRY_TIME, value: candle });
    });
    await Promise.all([...list, CandleRepository.upsertCandles(candles)]);
    return candles;
}

async function deleteCandle(candle: Candle): Promise<any> {
    return Promise.all([candleCache.remove(candle), CandleRepository.removeCandle(candle)]);
}

async function flushCandles(): Promise<any> {
    return candleCache.flush();
}

export const CacheRepository = {
    getInstrumentByToken,
    getInstrumentById,
    getCandle,
    writeCandles,
    deleteCandle,
    flushCandles,
};
