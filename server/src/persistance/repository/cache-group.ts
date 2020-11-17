import { Log, RedisService } from '../../infrastructure';
import { Candle } from '../../types';
interface KVPair {
    key: string;
    value: any;
}
export class CacheGroup {
    private _prefix: string;
    constructor(name: string, private allowNull: boolean = false) {
        this._prefix = `${name}CG`;
    }

    redisCacheKey(key: string): string {
        return `${this._prefix}:${key}`;
    }

    async flush(): Promise<number> {
        return RedisService.delWithPrefix(this.redisCacheKey('*'));
    }

    // eslint-disable-next-line sonarjs/cognitive-complexity
    async getMulti({ keys }: { keys: string[] }, callback?: (args: any) => Promise<any>): Promise<any> {
        const cachedKeys = keys.map((key) => this.redisCacheKey(key));
        const items = await RedisService.mget(...cachedKeys);
        const missingKeys: string[] = [];
        for (const [i, key] of cachedKeys.entries()) {
            if (items[i] == undefined) {
                missingKeys.push(key);
                continue;
            }
            const { value } = JSON.parse(items[i]);
            items[i] = value;
        }
        if (callback != undefined && missingKeys.length > 0) {
            Log.info(`Missing keys: ${missingKeys.length}`);
            const dbCandles: Candle[] = await callback(missingKeys);
            if (dbCandles.length > 0) {
                const dbCandleMap: Map<string, Candle> = new Map();
                for (const candle of dbCandles) {
                    dbCandleMap.set(candle.key, candle);
                }
                for (const [i, key] of cachedKeys.entries()) {
                    if (items[i] == undefined) {
                        items[i] = dbCandleMap.get(key);
                    }
                }
                await this.setMulti(
                    dbCandles.map(
                        (candle): KVPair => {
                            return {
                                key: candle.key,
                                value: candle,
                            };
                        },
                    ),
                );
            }
        }
        return items;
    }

    async get({ key }: { key: string }, callback: () => Promise<any>): Promise<any> {
        const redisArguments: string[] = [this.redisCacheKey(key)];
        const item = await RedisService.get(...redisArguments);
        if (item != undefined) {
            const { value, isnull } = JSON.parse(item);
            if (value != undefined) return value;
            if (isnull === true && this.allowNull) return undefined;
        }
        const value = await callback();
        return this.set({ key, value });
    }

    async set(item: KVPair): Promise<any> {
        await this.setMulti([item]);
        return item.value;
    }

    async setMulti(originalItems: KVPair[]): Promise<any> {
        const redisArguments: string[] = [];
        for (const originalItem of originalItems) {
            if (this.allowNull === false && originalItem.value == undefined) continue;
            const { key, value } = originalItem;
            redisArguments.push(this.redisCacheKey(key));
            redisArguments.push(JSON.stringify({ value, isnull: value == undefined }));
        }
        if (redisArguments.length > 0) await RedisService.mset(...redisArguments);
        return originalItems.map((item) => item.value);
    }

    async del(key: string): Promise<any> {
        return RedisService.del(this.redisCacheKey(key));
    }
}
