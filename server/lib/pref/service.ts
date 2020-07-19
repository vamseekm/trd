/* eslint-disable no-useless-constructor */
import { Service } from 'typedi';
import { getRepository, getConnection } from 'typeorm';
import { Redis } from '../infra';
import { Pref } from './entity';

@Service()
export class PrefService {
    constructor(private redis: Redis) { }

    async configGet(key: string, defaultValue: string): Promise<string> {
        return this.redis.cachedGet({ key, expiry: 12 * 3600 * 1000 }, async () => {
            const configItem = await getRepository(Pref)
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
        await getConnection().query(`INSERT INTO pref VALUES (?, ?) ON DUPLICATE KEY UPDATE value = ?`, [
            key,
            value,
            value,
        ]);
    }
}
