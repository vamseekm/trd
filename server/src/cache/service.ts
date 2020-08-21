import LruCache from 'lru-cache';
import { Service } from 'typedi';

import { logJson } from '../infra';
import { Instrument, InstrumentService } from '../instrument';

const instrumentTokenCache = new LruCache(1000);
const globalSymbolCache = new LruCache(1000);

@Service()
export class CacheService {
    private stats = { hits: 0, miss: 0, size: 0 };
    constructor(private instrumentSvc: InstrumentService) {}
    async getInstrumentByToken(instrumentToken: string): Promise<Instrument | undefined> {
        // const cacheKey = `instrument_by_token:${instrumentToken}`;
        // console.log(this.instrumentTokenCache[instrumentToken]);
        // instances[this] = true;
        // console.log(`Hits: ${this.hits} Miss: ${this.miss} Size: ${this.size}, Count: ${this.count}`);
        if (instrumentTokenCache.has(instrumentToken)) {
            this.stats.hits += 1;
            return globalSymbolCache.get(instrumentTokenCache.get(instrumentToken)) as Instrument;
        }
        this.stats.miss += 1;
        logJson('Instrument token cache stats:', this.stats);
        const instrument = await this.instrumentSvc.fetchInstrumentByToken(instrumentToken);
        if (instrument) {
            // await this.redisSvc.set([cacheKey, JSON.stringify(instrument), 'PX', 12 * 3600]);
            globalSymbolCache.set(instrument.globalSymbol, instrument);
            instrumentTokenCache.set(instrumentToken, instrument.globalSymbol);
            this.stats.size = instrumentTokenCache.length;
            return instrument;
        } else {
            console.log('Fetch fail: ${instrumentToken}');
        }
    }
}
