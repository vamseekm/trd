import lodash from 'lodash';

import { RedisService } from '../../infra';
export class CacheGroup {
    private _prefix: string;
    constructor(name: string, private allowNull: boolean = false) {
        this._prefix = `${name}CG`;
    }

    redisCacheKey(key: string): string {
        return `${this._prefix}:${key}`;
    }

    async flush(): Promise<number> {
        const keys = await RedisService.keys(this.redisCacheKey('*'));
        if (keys.length === 0) return 0;
        for (const chunk of lodash.chunk(keys, 1000)) {
            await RedisService.del(...chunk);
        }
        return keys.length;
    }

    async getMulti(
        { keys, expiry = 24 * 60 * 60 * 1000 }: { keys: string[]; expiry?: number },
        callback: (args: any) => Promise<any>,
    ): Promise<any> {
        // keys = ['NFO:BANKNIFTY20O1521800CE:M01:2010121011', 'NFO:BANKNIFTY20O1524000PE:M01:2010121011'];
        const cachedKeys = keys.map((key) => this.redisCacheKey(key));
        const items = await RedisService.mget(...cachedKeys);
        return Promise.all(
            items.map(async (item: any, index: number) => {
                if (item != undefined) {
                    const { value } = JSON.parse(item);
                    return value;
                } else {
                    const missedValue = await callback(keys[index]);
                    return this.set({ key: keys[index], value: missedValue, expiry });
                }
            }),
        );
    }

    async get(
        { key, expiry = 24 * 60 * 60 * 1000 }: { key: string; expiry?: number },
        callback: () => Promise<any>,
    ): Promise<any> {
        const redisArguments: string[] = [this.redisCacheKey(key)];
        const item = await RedisService.get(...redisArguments);
        if (item != undefined) {
            const { value, isnull } = JSON.parse(item);
            if (value != undefined) return value;
            if (isnull === true && this.allowNull) return undefined;
        }
        const value = await callback();
        return this.set({ key, expiry, value });
    }

    async set({ key, expiry = 24 * 3600 * 1000, value }: { key: string; expiry?: number; value: any }): Promise<any> {
        if (value == undefined && this.allowNull === false) return;
        // console.log('set', key, value);
        const redisArguments: string[] = [this.redisCacheKey(key)];
        redisArguments.push(JSON.stringify({ value, isnull: value == undefined }));
        if (expiry) {
            redisArguments.push('PX', `${expiry}`);
        }
        // console.log(redisArguments);
        // console.log(new Error().stack);
        // console.log(redisArguments);
        await RedisService.set(...redisArguments);
        return value;
    }

    async del(key: string): Promise<any> {
        return RedisService.del(this.redisCacheKey(key));
    }
}
