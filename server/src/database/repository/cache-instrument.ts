import LRUCache from 'lru-cache';

import { Instrument } from '../../types';
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

export const InstrumentCacheRepository = {
    getInstrumentByToken,
    getInstrumentById,
};
