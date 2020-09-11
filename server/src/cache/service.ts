import LruCache from 'lru-cache';

import { InstrumentModel } from '../database';
import { Log } from '../infra';
import { InstrumentService } from '../instrument';

const instrumentTokenCache = new LruCache(1000);
const instrumentIdCache = new LruCache(1000);
const stats = { hits: 0, miss: 0, tokenSize: 0, idSize: 0 };

async function getInstrumentByToken(instrumentToken: string): Promise<InstrumentModel | undefined> {
    if (instrumentTokenCache.has(instrumentToken)) {
        stats.hits += 1;
        return instrumentIdCache.get(instrumentTokenCache.get(instrumentToken)) as InstrumentModel;
    }
    stats.miss += 1;
    const instrument = await InstrumentService.fetchInstrumentByToken(instrumentToken);
    if (instrument == undefined) return;
    Log.json('Instrument token cache stats:', stats);
    Log.json('Instrument miss:', {
        token: instrumentToken,
        id: instrument.id,
    });
    instrumentIdCache.set(instrument.id, instrument);
    instrumentTokenCache.set(instrumentToken, instrument.id);
    stats.tokenSize = instrumentTokenCache.length;
    stats.idSize = instrumentIdCache.length;
    return instrument;
}

export const CacheService = {
    getInstrumentByToken,
};
