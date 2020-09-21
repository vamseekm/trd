/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-var-requires */
/* eslint-disable no-useless-constructor */
import redis from 'redis';

import { Config } from './config';
import { Log } from './logger';

function redisCacheKey(key: string): string {
    return `cache:${key}`;
}

const client = redis.createClient(Config.get('redis'));
client.on('error', (error) => Log.error(error));

function proxyCommand(name: string, arguments_: any[]): Promise<any> {
    return new Promise((resolve: any, reject: any) => {
        arguments_.push((error: any, ...results: any[]) => {
            if (error) {
                reject(error, ...results);
            } else {
                resolve(...results);
            }
        });
        (client as any)[name].apply(client, arguments_);
    });
}

function get(...arguments_: any[]): Promise<string> {
    return proxyCommand('get', arguments_);
}

function set(...arguments_: any[]): Promise<void> {
    return proxyCommand('set', arguments_);
}

function del(...arguments_: any[]): Promise<void> {
    return proxyCommand('del', arguments_);
}

async function cacheGet({ key, expiry }: { key: string; expiry?: number }, callback: () => Promise<any>): Promise<any> {
    const arguments_: any[] = [redisCacheKey(key)];
    const item = await get(...arguments_);
    if (item) {
        return JSON.parse(item).value;
    }
    const value = await callback();
    arguments_.push(JSON.stringify({ value }));
    if (expiry) {
        arguments_.push('PX', expiry);
    }
    await set(...arguments_);
    return value;
}

// export async function cacheDel(key: string): Promise<void> {
//     return redisDel(redisCacheKey(key));
// }
export const Redis = {
    get,
    set,
    del,
    cacheGet,
};
