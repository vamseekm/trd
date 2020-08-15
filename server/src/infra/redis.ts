/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-var-requires */
/* eslint-disable no-useless-constructor */
import autoBind from 'auto-bind';
import redis from 'redis';
import { Service } from 'typedi';

import { Config } from './config';
import { LoggerService } from './logger';

function redisCacheKey(key: string): string {
    return `cache:${key}`;
}

@Service()
export class Redis {
    private client: redis.RedisClient;

    constructor(private config: Config, private logger: LoggerService) {
        const redisConfig = this.config.get('redis');
        logger.info('Connecting to Redis...');
        this.client = redis.createClient(redisConfig);
        this.client.on('error', (error) => logger.error(error));
        autoBind(this);
    }

    proxyCommand(name: string, arguments_: any[]): Promise<any> {
        return new Promise((resolve: any, reject: any) => {
            arguments_.push((error: any, ...results: any[]) => {
                if (error) {
                    reject(error, ...results);
                } else {
                    resolve(...results);
                }
            });
            (this.client as any)[name].apply(this.client, arguments_);
        });
    }

    get(...arguments_: any[]): Promise<string> {
        return this.proxyCommand('get', arguments_);
    }

    set(...arguments_: any[]): Promise<void> {
        return this.proxyCommand('set', arguments_);
    }

    del(...arguments_: any[]): Promise<void> {
        return this.proxyCommand('del', arguments_);
    }

    async cachedGet({ key, expiry }: { key: string; expiry?: number }, callback: () => Promise<any>): Promise<any> {
        const arguments_: any[] = [redisCacheKey(key)];
        const item = await this.get(...arguments_);
        if (item) {
            return JSON.parse(item).value;
        }
        const value = await callback();
        arguments_.push(JSON.stringify({ value }));
        if (expiry) {
            arguments_.push('PX', expiry);
        }
        await this.set(...arguments_);
        return value;
    }

    async cacheDel(key: string): Promise<void> {
        return this.del(redisCacheKey(key));
    }
}
