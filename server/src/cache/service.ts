import LruCache from 'lru-cache';

import { Log } from '../infra';
import { InstrumentRepository } from '../instrument/repository/instrument';
import { IInstrument } from '../types';

const TOTAL_INSTRUMENTS = 1000;
const instrumentTokenCache = new LruCache<string, string>(TOTAL_INSTRUMENTS);
const instrumentIdCache = new LruCache<string, IInstrument>(TOTAL_INSTRUMENTS);

async function getInstrumentByToken(instrumentToken: number): Promise<IInstrument | undefined> {
    const instrumentId = instrumentTokenCache.get(`${instrumentToken}`);
    if (instrumentId != undefined) return getInstrumentById(instrumentId);
    const instrument = await InstrumentRepository.findOneBy({ instrumentToken });
    return cacheInstrument(instrument);
}

async function getInstrumentById(id: string): Promise<IInstrument | undefined> {
    const cachedInstrument = instrumentIdCache.get(id);
    if (cachedInstrument != undefined) return cachedInstrument;
    const instrument = await InstrumentRepository.findOneBy({ id });
    Log.json(`Cache miss: ${instrument?.id}`, {
        tokenCache: instrumentTokenCache.length,
        idCache: instrumentIdCache.length,
    });
    return cacheInstrument(instrument);
}

async function cacheInstrument(instrument: IInstrument | null): Promise<IInstrument | undefined> {
    if (instrument == undefined) return;
    instrumentIdCache.set(instrument.id, instrument);
    instrumentTokenCache.set(`${instrument.instrumentToken}`, instrument.id);
    return instrument;
}

export const CacheService = {
    getInstrumentByToken,
};
