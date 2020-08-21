/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-var-requires */
/* eslint-disable no-useless-constructor */
import redis from 'redis';

import { logError } from '.';
import { configGet } from './config';

function redisCacheKey(key: string): string {
    return `cache:${key}`;
}

const client = redis.createClient(configGet('redis'));
client.on('error', (error) => logError(error));

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

export function redisGet(...arguments_: any[]): Promise<string> {
    return proxyCommand('get', arguments_);
}

export function redisSet(...arguments_: any[]): Promise<void> {
    return proxyCommand('set', arguments_);
}

export function redisDel(...arguments_: any[]): Promise<void> {
    return proxyCommand('del', arguments_);
}

function redisXadd(...arguments_: any[]): Promise<void> {
    return proxyCommand('xadd', arguments_);
}

function redisXread(...arguments_: any[]): Promise<void> {
    return proxyCommand('xread', arguments_);
}

export async function redisCachedGet(
    { key, expiry }: { key: string; expiry?: number },
    callback: () => Promise<any>,
): Promise<any> {
    const arguments_: any[] = [redisCacheKey(key)];
    const item = await redisGet(...arguments_);
    if (item) {
        return JSON.parse(item).value;
    }
    const value = await callback();
    arguments_.push(JSON.stringify({ value }));
    if (expiry) {
        arguments_.push('PX', expiry);
    }
    await redisSet(...arguments_);
    return value;
}

async function cacheDel(key: string): Promise<void> {
    return redisDel(redisCacheKey(key));
}
