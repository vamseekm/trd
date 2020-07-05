/* eslint-disable no-useless-constructor */
import { Service } from 'typedi';
import { getRepository, getConnection } from 'typeorm';
import { MySQL, Redis } from '../../infra';
import { ConfigModel } from '../entity/Config';

function redisCacheKey(key: string) {
    return `cache:${key}`;
}

@Service()
export class DBService {
    constructor(private db: MySQL, private redis: Redis) {}

    async configGet(key: string, defaultValue: string): Promise<string> {
        return this.redis.cachedGet({ key, expiry: 12 * 3600 * 1000 }, async () => {
            const configItem = await getRepository(ConfigModel)
                .createQueryBuilder('config')
                .where('config.key = :key', { key })
                .getOne();
            if (configItem) {
                const { value } = configItem;
                return value;
            }
            return defaultValue || '';
        });
    }

    async configSet(key: string, value: string): Promise<void> {
        await this.redis.cacheDel(key);
        await getConnection().query('INSERT INTO config_model VALUES (?, ?) ON DUPLICATE KEY UPDATE value = ?', [
            key,
            value,
            value,
        ]);
    }
}
