/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-var-requires */
/* eslint-disable no-useless-constructor */
import { Service } from 'typedi';
import redis, { RedisClient } from 'redis';
import autoBind from 'auto-bind';
import { Config } from './config';
import { Logger } from './logger';

function redisCacheKey(key: string): string {
    return `cache:${key}`;
}

@Service()
export class Redis {
    private client: redis.RedisClient;

    constructor(private config: Config, private logger: Logger) {
        const redisConfig = this.config.get('redis');
        this.client = redis.createClient(redisConfig);
        this.client.on('error', (err) => logger.error(err));
        autoBind(this);
    }

    proxyCommand(name: string, args: any[]): Promise<any> {
        return new Promise((resolve: any, reject: any) => {
            args.push((err: any, ...results: any[]) => {
                if (err) {
                    reject(err, ...results);
                } else {
                    resolve(...results);
                }
            });
            (this.client as any)[name].apply(this.client, args);
        });
    }

    get(...args: any[]): Promise<string> {
        return this.proxyCommand('get', args);
    }

    set(...args: any[]): Promise<void> {
        return this.proxyCommand('set', args);
    }

    del(...args: any[]): Promise<void> {
        return this.proxyCommand('del', args);
    }

    async cachedGet({ key, expiry }: { key: string; expiry?: number }, cb: () => Promise<any>): Promise<any> {
        const args: any[] = [redisCacheKey(key)];
        const item = await this.get(...args);
        if (item) {
            return JSON.parse(item).value;
        }
        const value = await cb();
        args.push(JSON.stringify({ value }));
        if (expiry) {
            args.push('PX', expiry);
        }
        await this.set(...args);
        return value;
    }

    async cacheDel(key: string): Promise<void> {
        return this.del(redisCacheKey(key));
    }
}
