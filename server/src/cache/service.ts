import LruCache from 'lru-cache';

import { InstrumentModel } from '../database';
import { Log } from '../infra';
import { InstrumentService } from '../instrument';

const instrumentTokenCache = new LruCache(1000);
const globalSymbolCache = new LruCache(1000);
const stats = { hits: 0, miss: 0, size: 0 };

async function getInstrumentByToken(instrumentToken: string): Promise<InstrumentModel | undefined> {
    if (instrumentTokenCache.has(instrumentToken)) {
        stats.hits += 1;
        return globalSymbolCache.get(instrumentTokenCache.get(instrumentToken)) as InstrumentModel;
    }
    stats.miss += 1;
    Log.json('Instrument token cache stats:', stats);
    const instrument = await InstrumentService.fetchInstrumentByToken(instrumentToken);
    if (instrument == undefined) return;
    globalSymbolCache.set(instrument.id, instrument);
    instrumentTokenCache.set(instrumentToken, instrument.id);
    stats.size = instrumentTokenCache.length;
    return instrument;
}

export const CacheService = {
    getInstrumentByToken,
};
