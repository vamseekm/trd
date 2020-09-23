import { RedisService } from '../../infra';
export class CacheGroup {
    constructor(private name: string) {}

    redisCacheKey(key: string): string {
        return `cache:${this.name}:${key}`;
    }

    async get({ key, expiry = 3600 }: { key: string; expiry?: number }, callback: () => Promise<any>): Promise<any> {
        const arguments_: any[] = [this.redisCacheKey(key)];
        const item = await RedisService.get(...arguments_);
        if (item != undefined) return JSON.parse(item).value;
        const value = await callback();
        return this.set({ key, expiry, value });
    }

    async set({ key, expiry = 3600, value }: { key: string; expiry?: number; value: any }): Promise<any> {
        if (value == undefined) return;
        const arguments_: any[] = [this.redisCacheKey(key)];
        arguments_.push(JSON.stringify({ value }));
        if (expiry) {
            arguments_.push('PX', expiry);
        }
        await RedisService.set(...arguments_);
        return value;
    }
}
