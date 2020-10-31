import LRUCache from 'lru-cache';

import { CandleWritePump } from '../../candle';
import { RedisService } from '../../infra';
import { Candle, Instrument, INSTRUMENT_ID_SEPERATOR, validateCandle } from '../../types';
import { CandleUtil } from '../../util';
import { CandleModel } from '../model';
import { CacheGroup } from './cache-group';
import { CandleRepository } from './candle';
import { InstrumentRepository } from './instrument';
import { SortedSet } from './sorted-set';

const INSTRUMENT_CACHE_EXPIRY = 24 * 3600 * 1000;
const INSTRUMENT_COUNT = 5000;
// const instrumentTokenCache = new CacheGroup('ins_token');
const instrumentTokenCache = new LRUCache<string, string>({
    max: INSTRUMENT_COUNT,
    maxAge: INSTRUMENT_CACHE_EXPIRY,
});

const CANDLE_TIME_PREFIX = 'CT';

function getCandleTimeRecord(key: string): { key: string; score: string; value: string } {
    const tokens = key.split(INSTRUMENT_ID_SEPERATOR);
    if (tokens.length != 4) throw new Error(`Invalid candle key format: ${key}`);
    const sortedSetKeySuffix = tokens.slice(0, 3).join(INSTRUMENT_ID_SEPERATOR);
    const value = tokens[3];
    return { key: `${CANDLE_TIME_PREFIX}:${sortedSetKeySuffix}`, score: value, value };
}

async function setCandleRecords(candles: Candle[]): Promise<any> {
    const items = candles.flatMap(({ key }) => {
        return [getCandleTimeRecord(key), CandleWritePump.keyToCandleMutateRecord(key)];
    });
    return SortedSet.writeItems({ items });
}

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
const candleCache = new CacheGroup('C', true);

type GetCandlesType = typeof CandleRepository.getCandles;

async function getCandles(keys: string[], callback: GetCandlesType = CandleRepository.getCandles): Promise<Candle[]> {
    const candles = await candleCache.getMulti({ keys }, callback);
    for (const [i, candle] of candles.entries()) {
        if (candle == undefined) continue;
        if (typeof candle.timestamp === 'string') {
            candle.timestamp = new Date(candle.timestamp);
        }
        candle.volume = Number.parseInt(candle.volume);
        const { exchange, tradingSymbol, timeCode, interval } = CandleUtil.parseCandleKey(keys[i]);
        candle.key = keys[i];
        candle.exchange = exchange;
        candle.instrumentId = `${exchange}${INSTRUMENT_ID_SEPERATOR}${tradingSymbol}`;
        candle.openInterest = candle.openInterest || 0;
        candle.interval = interval;
        candle.timeCode = Number.parseInt(timeCode, 10);
        if (validateCandle(candle) === false) {
            console.log(candle);
            throw new Error(JSON.stringify(validateCandle.errors, undefined, 2));
        }
    }
    return candles;
}

async function getCandle(key: string | undefined): Promise<Candle | undefined> {
    if (key == undefined) return;
    return (await getCandles([key]))[0];
}

async function queueForDBWrites(candles: Candle[]): Promise<any> {
    const items = candles.flatMap(({ key }) => {
        return [CandleWritePump.keyToCandleMutateRecord(key)];
    });
    return SortedSet.writeItems({ items });
}

// async function cacheSetCandle(key: string, candle?: Candle): Promise<any> {
//     return candleCache.set({ key, value: compactCandle(candle) });
// }

function compactCandle(candle?: Candle): any {
    const smallCandle: any = Object.assign({}, candle);
    if (smallCandle != undefined) {
        delete smallCandle.instrumentId;
        delete smallCandle.exchange;
        delete smallCandle.interval;
        delete smallCandle.timeCode;
        delete smallCandle.key;
    }
    return smallCandle;
}

async function setCandles(candles: Candle[]): Promise<any> {
    const smallCandles = candles.map((candle) => {
        return {
            key: candle.key,
            value: compactCandle(candle),
        };
    });
    return candleCache.setMulti(smallCandles);
}

async function writeCandles(candles: Candle[]): Promise<Candle[]> {
    if (candles.length === 0) return candles;
    await setCandles(candles);
    await setCandleRecords(candles);
    return candles;
}

async function deleteCandle({ key }: { key: string }): Promise<any> {
    await candleCache.del(key);
    return CandleModel.destroy({ where: { key } });
}

async function clearCandleTimes(): Promise<any> {
    return Promise.all([RedisService.delWithPrefix(`${CANDLE_TIME_PREFIX}:*`), CandleWritePump.clear()]);
}

async function flushCandleCache(): Promise<any> {
    return Promise.all([clearCandleTimes(), candleCache.flush()]);
}

export const CandleCacheRepository = {
    getInstrumentByToken,
    getInstrumentById,
    writeCandles,
    getCandle,
    getCandles,
    deleteCandle,
    flushCandleCache,
    queueForDBWrites,
};
