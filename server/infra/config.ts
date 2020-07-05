/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
/* eslint-disable no-useless-constructor */
import { Service } from 'typedi';
import config from 'config';
import { getRepository, getConnection } from 'typeorm';
import { DB } from '.';
import { ConfigModel } from '../lib/entity/Config';

export const KITE_API_KEY = 'KITE_API_KEY';
export const KITE_API_SECRET = 'KITE_API_SECRET';
export const KITE_ACCESS_TOKEN = 'KITE_ACCESS_TOKEN';
export const HTTP_API_PORT = 'HTTP_API_PORT';
@Service()
export class Config {
    constructor(private db: DB) {}

    async get(key: string, defaultValue?: any): Promise<string> {
        if (config.has(key)) {
            return config.get(key);
        }
        const configItem = await getRepository(ConfigModel)
            .createQueryBuilder('config')
            .where('config.key = :key', { key })
            .getOne();
        if (configItem) {
            return configItem.value;
        }
        return defaultValue || '';
    }

    async set(key: string, value: string): Promise<void> {
        if (config.has(key)) {
            throw new Error(`Read-only config already has the key: ${key}`);
        }
        await getConnection().query('INSERT INTO config_model VALUES (?, ?) ON DUPLICATE KEY UPDATE value = ?', [
            key,
            value,
            value,
        ]);
    }
}
