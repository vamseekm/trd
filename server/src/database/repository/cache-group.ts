import lodash from 'lodash';

import { RedisService } from '../../infra';
const CACHE_PREFIX = 'cache:';
export class CacheGroup {
    private _prefix: string;
    constructor(private name: string) {
        this._prefix = `cache:${name}`;
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

    async get({ key, expiry = 3600 }: { key: string; expiry?: number }, callback: () => Promise<any>): Promise<any> {
        const redisArguments: string[] = [this.redisCacheKey(key)];
        const item = await RedisService.get(...redisArguments);
        if (item != undefined) return JSON.parse(item).value;
        const value = await callback();
        return this.set({ key, expiry, value });
    }

    async set({ key, expiry = 3600, value }: { key: string; expiry?: number; value: any }): Promise<any> {
        if (value == undefined) return;
        const redisArguments: string[] = [this.redisCacheKey(key)];
        redisArguments.push(JSON.stringify({ value }));
        if (expiry) {
            redisArguments.push('PX', `${expiry}`);
        }
        await RedisService.set(...redisArguments);
        return value;
    }

    async remove({ key }: { key: string }): Promise<any> {
        return RedisService.del(this.redisCacheKey(key));
    }
}
