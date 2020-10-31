import { CandleCacheRepository, CandleRepository } from '../database';
import { Log, RedisService } from '../infra';
import { RateLimiter, sleep } from '../util';

const QUEUE_CANDLE_DB_WRITE_KEY = 'QUEUE_WRITE_DB';
const CURRENT_QUEUE_CANDLE_DB_WRITE_KEY = `${QUEUE_CANDLE_DB_WRITE_KEY}:CURRENT`;

function keyToCandleMutateRecord(key: string): { key: string; score: string; value: string } {
    return { key: `${QUEUE_CANDLE_DB_WRITE_KEY}`, score: `${Date.now()}`, value: key };
}

async function start(): Promise<any> {
    const nopFunc = async () => {
        return [];
    };
    const limiter = new RateLimiter({ bufferSize: 5000, delay: 1000, maxDelay: 1000 });
    const currentQueue = CURRENT_QUEUE_CANDLE_DB_WRITE_KEY;
    // eslint-disable-next-line no-constant-condition
    while (true) {
        try {
            await RedisService.renameIfNotExists(QUEUE_CANDLE_DB_WRITE_KEY, currentQueue);
            // eslint-disable-next-line no-empty
        } catch {}
        const iterTime = Date.now();
        const currentQueueSize = Number.parseInt(await RedisService.sortedSetSize(currentQueue), 10);
        const queueSize = Number.parseInt(await RedisService.sortedSetSize(QUEUE_CANDLE_DB_WRITE_KEY));
        let totalSize = queueSize + currentQueueSize;
        const { batchSize, delay } = limiter.computeDelayAndBatchSize(totalSize);
        const keys = await RedisService.sortedSetGetByRange(currentQueue, 0, batchSize);
        if (keys.length > 0) {
            const candles = await CandleCacheRepository.getCandles(keys, nopFunc);
            await CandleRepository.upsertCandles(candles);
            await RedisService.sortedSetRemove(currentQueue, ...keys);
            totalSize -= keys.length;
        }
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
        if (delay > 0) await sleep(delay);
    }
}

async function clear(): Promise<any> {
    return Promise.all([
        RedisService.del(QUEUE_CANDLE_DB_WRITE_KEY),
        RedisService.del(CURRENT_QUEUE_CANDLE_DB_WRITE_KEY),
    ]);
}

export const CandleWritePump = {
    start,
    clear,
    keyToCandleMutateRecord,
};
