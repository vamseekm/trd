import LRUCache from 'lru-cache';

import { CandleService } from '../../candle';
import { Log, RedisService } from '../../infra';
import { Candle, Instrument, INSTRUMENT_ID_SEPERATOR, validateCandle } from '../../types';
import { sleep } from '../../util';
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
        const { exchange, tradingSymbol, timeCode, interval } = CandleService.parseCandleKey(keys[i]);
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

const CANDLE_TIME_PREFIX = 'CT';

function getCandleTimeRecord(key: string): { key: string; score: string; value: string } {
    const tokens = key.split(INSTRUMENT_ID_SEPERATOR);
    if (tokens.length != 4) throw new Error(`Invalid candle key format: ${key}`);
    const sortedSetKeySuffix = tokens.slice(0, 3).join(INSTRUMENT_ID_SEPERATOR);
    const value = tokens[3];
    return { key: `${CANDLE_TIME_PREFIX}:${sortedSetKeySuffix}`, score: value, value };
}

const QUEUE_CANDLE_DB_WRITE_KEY = 'QUEUE_WRITE_DB';
function getCandleDBWriteTimeRecord(key: string): { key: string; score: string; value: string } {
    return { key: `${QUEUE_CANDLE_DB_WRITE_KEY}`, score: `${Date.now()}`, value: key };
}

async function setCandleRecords(candles: Candle[]): Promise<any> {
    const items = candles.flatMap(({ key }) => {
        return [getCandleTimeRecord(key)];
    });
    return SortedSet.writeItems({ items });
}

async function queueForDBWrites(candles: Candle[]): Promise<any> {
    const items = candles.flatMap(({ key }) => {
        return [getCandleDBWriteTimeRecord(key)];
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
const CURRENT_QUEUE_CANDLE_DB_WRITE_KEY = `${QUEUE_CANDLE_DB_WRITE_KEY}:CURRENT`;
async function clearCandleTimes(): Promise<any> {
    return Promise.all([
        RedisService.delWithPrefix(`${CANDLE_TIME_PREFIX}:*`),
        RedisService.del(QUEUE_CANDLE_DB_WRITE_KEY),
        RedisService.del(CURRENT_QUEUE_CANDLE_DB_WRITE_KEY),
    ]);
}

async function flushCandleCache(): Promise<any> {
    return Promise.all([clearCandleTimes(), candleCache.flush()]);
}

async function startWritePump(): Promise<any> {
    const nopFunc = async () => {
        return [];
    };
    const BUFFER_SIZE = 5000;
    let delay = 1000;
    const stats: number[] = [0];
    let iter = 0;
    while (true) {
        iter = (iter + 1) % 10;
        const currentQueue = CURRENT_QUEUE_CANDLE_DB_WRITE_KEY;
        try {
            await RedisService.renameIfNotExists(QUEUE_CANDLE_DB_WRITE_KEY, currentQueue);
        } catch {}
        const iterTime = Date.now();
        const currentQueueSize = Number.parseInt(await RedisService.sortedSetSize(currentQueue), 10);
        const queueSize = Number.parseInt(await RedisService.sortedSetSize(QUEUE_CANDLE_DB_WRITE_KEY));
        let totalSize = queueSize + currentQueueSize;
        stats[iter] = stats[iter] || 0;
        stats[iter] = totalSize;
        const filteredStats = stats.filter((num) => !!num);
        if (filteredStats.length === 0) filteredStats.push(0);
        const avgTotalSize = filteredStats.reduce((a, b) => a + b, 0) / filteredStats.length;
        const batchSize = Math.max(100, Math.floor(avgTotalSize * 0.1));

        const keys = await RedisService.sortedSetGetByRange(currentQueue, 0, batchSize);
        if (keys.length > 0) {
            const candles = await getCandles(keys, nopFunc);
            await CandleRepository.upsertCandles(candles);
            await RedisService.sortedSetRemove(currentQueue, ...keys);
        }
        totalSize -= batchSize;
        if (totalSize > BUFFER_SIZE) delay *= 0.9;
        if (totalSize < BUFFER_SIZE) delay *= 2.0;
        delay = Math.floor(delay);
        delay = Math.min(1000, delay);
        delay = Math.max(10, delay);
        Log.info(
            `\tWrote ${keys.length.toString().padStart(4, ' ')} candles in ${(Date.now() - iterTime)
                .toString()
                .padStart(4)} ms remaining ${currentQueueSize
                .toString()
                .padStart(5, ' ')}/${queueSize.toString().padStart(5, ' ')} delay: ${delay
                .toString()
                .padStart(4, ' ')} ms total: ${totalSize.toString().padStart(7, ' ')}`,
        );
        if (keys.length === 0) await RedisService.del(currentQueue);
        // console.log(stats);
        await sleep(delay);
    }
}

export const CandleCacheRepository = {
    getInstrumentByToken,
    getInstrumentById,
    writeCandles,
    queueForDBWrites,
    getCandle,
    getCandles,
    deleteCandle,
    flushCandleCache,
    startWritePump,
};
