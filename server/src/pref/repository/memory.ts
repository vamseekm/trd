import { Service } from 'typedi';

import { Redis } from '../../infra';

@Service()
export class PrefMemoryRepository {
    constructor(private redis: Redis) {}

    configKey(key: string): string {
        return `pref:${key}`;
    }

    async get(key: string): Promise<string> {
        return this.redis.get([this.configKey(key)]);
    }

    async set(key: string, value: string): Promise<void> {
        await this.redis.set([this.configKey(key), value, 'PX', 12 * 3600 * 3600]);
    }

    async remove(key: string): Promise<void> {
        return this.redis.del([this.configKey(key)]);
    }
}
