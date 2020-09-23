import { Candle, IInstrument } from '../../types';
import { CacheGroup } from './cache-group';
import { CandleRepository } from './candle';
import { InstrumentRepository } from './instrument';

const INSTRUMENT_CACHE_EXPIRY = 24 * 3600 * 1000;
const instrumentTokenCache = new CacheGroup('ins_token');
async function getInstrumentByToken(instrumentToken: number): Promise<IInstrument | undefined> {
    return instrumentTokenCache.get({ key: `${instrumentToken}`, expiry: INSTRUMENT_CACHE_EXPIRY }, async () => {
        return cacheInstrument(await InstrumentRepository.findOneBy({ instrumentToken }));
    });
}
const instrumentIdCache = new CacheGroup('ins_id');
async function getInstrumentById(id: string): Promise<IInstrument | undefined> {
    return instrumentIdCache.get({ key: id, expiry: INSTRUMENT_CACHE_EXPIRY }, async () => {
        console.log('miss:', id);
        return cacheInstrument(await InstrumentRepository.findOneBy({ id }));
    });
}
async function cacheInstrument(instrument: IInstrument | null): Promise<IInstrument | undefined> {
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
    return candleCache.get({ key, expiry: CANDLE_CACHE_EXPIRY_TIME }, async () => {
        return CandleRepository.getCandle(key);
    });
}

async function writeCandles(candles: Candle[]): Promise<Candle[]> {
    await Promise.all(
        candles.map(async (candle) => {
            return candleCache.set({ key: candle.key, expiry: CANDLE_CACHE_EXPIRY_TIME, value: candle });
        }),
    );
    await CandleRepository.upsertCandles(candles);
    return candles;
}

export const CacheRepository = {
    getInstrumentByToken,
    getInstrumentById,
    getCandle,
    writeCandles,
};
