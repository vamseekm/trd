import { CandleWritePump } from '../../candle';
import { RedisService } from '../../infrastructure';
import { Candle, CandleConsts, InstrumentConsts, validateCandle } from '../../types';
import { CandleUtil } from '../../util';
import { CandleModel } from '../model';
import { CacheGroup } from './cache-group';
import { CandleRepository } from './candle';
import { SortedSet } from './sorted-set';

const CANDLE_TIME_PREFIX = 'CT';

function getCandleTimeRecord(key: string): { key: string; score: string; value: string } {
    const tokens = key.split(InstrumentConsts.ID_SEPERATOR);
    if (tokens.length != 4) throw new Error(`Invalid candle key format: ${key}`);
    const sortedSetKeySuffix = tokens.slice(0, 3).join(InstrumentConsts.ID_SEPERATOR);
    const value = tokens[3];
    return { key: `${CANDLE_TIME_PREFIX}:${sortedSetKeySuffix}`, score: value, value };
}

function getCandleMutateRecord(key: string): { key: string; score: string; value: string } {
    return { key: `${CandleConsts.QUEUE_CANDLE_DB_WRITE_KEY}`, score: `${Date.now()}`, value: key };
}

async function setCandleRecords(candles: Candle[]): Promise<any> {
    const items = candles.map(({ key }) => {
        return getCandleTimeRecord(key);
    });
    return SortedSet.writeItems({ items });
}

// const candleCache = new LRUCache<string, Candle | undefined>({ max: 20000, maxAge: CANDLE_CACHE_EXPIRY_TIME });
const candleCache = new CacheGroup('C', true);

type GetCandlesType = typeof CandleRepository.getCandles;

async function getCandles(
    keys: string[],
    callback: GetCandlesType = CandleRepository.getCandles,
): Promise<(Candle | undefined)[]> {
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
        candle.instrumentId = `${exchange}${InstrumentConsts.ID_SEPERATOR}${tradingSymbol}`;
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
        return [getCandleMutateRecord(key)];
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
    writeCandles,
    getCandle,
    getCandles,
    deleteCandle,
    flushCandleCache,
    queueForDBWrites,
};
