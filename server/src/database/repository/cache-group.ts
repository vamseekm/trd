import lodash from 'lodash';

import { RedisService } from '../../infra';
const CACHE_PREFIX = 'cache:';
export class CacheGroup {
    private _prefix: string;
    constructor(private name: string, private allowNull: boolean = false) {
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

    async get(
        { key, expiry = 24 * 3600 * 1000 }: { key: string; expiry?: number },
        callback: () => Promise<any>,
    ): Promise<any> {
        const redisArguments: string[] = [this.redisCacheKey(key)];
        const item = await RedisService.get(...redisArguments);
        if (item != undefined) {
            const { value, isnull } = JSON.parse(item);
            if (isnull === true && this.allowNull) return undefined;
            if (isnull === false) return value;
        }
        const value = await callback();
        return this.set({ key, expiry, value });
    }

    async set({ key, expiry = 24 * 3600 * 1000, value }: { key: string; expiry?: number; value: any }): Promise<any> {
        if (value == undefined && this.allowNull === false) return;
        const redisArguments: string[] = [this.redisCacheKey(key)];
        redisArguments.push(JSON.stringify({ value, isnull: value == undefined }));
        if (expiry) {
            redisArguments.push('PX', `${expiry}`);
        }
        await RedisService.set(...redisArguments);
        return value;
    }

    async remove(key: string): Promise<any> {
        return RedisService.del(this.redisCacheKey(key));
    }
}
