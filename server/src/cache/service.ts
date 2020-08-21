import LruCache from 'lru-cache';

import { Log } from '../infra';
import { Instrument, InstrumentService } from '../instrument';

const instrumentTokenCache = new LruCache(1000);
const globalSymbolCache = new LruCache(1000);
const stats = { hits: 0, miss: 0, size: 0 };

async function getInstrumentByToken(instrumentToken: string): Promise<Instrument | undefined> {
    if (instrumentTokenCache.has(instrumentToken)) {
        stats.hits += 1;
        return globalSymbolCache.get(instrumentTokenCache.get(instrumentToken)) as Instrument;
    }
    stats.miss += 1;
    Log.json('Instrument token cache stats:', stats);
    const instrument = await InstrumentService.fetchInstrumentByToken(instrumentToken);
    if (instrument) {
        globalSymbolCache.set(instrument.globalSymbol, instrument);
        instrumentTokenCache.set(instrumentToken, instrument.globalSymbol);
        stats.size = instrumentTokenCache.length;
        return instrument;
    } else {
        console.log('Fetch fail: ${instrumentToken}');
    }
}

export const CacheService = {
    getInstrumentByToken,
};
