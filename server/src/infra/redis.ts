/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-var-requires */
/* eslint-disable no-useless-constructor */
import lodash from 'lodash';
import redis from 'redis';

import { Config } from './config';
import { Log } from './logger';

const client = redis.createClient(Config.get('redis'));
client.on('error', (error) => Log.error(error));
client.on('reconnecting', (info) => Log.json('Redis reconnecting', info));
client.on('connect', () => Log.json('Redis connected.'));
// client.on('ready', () => Log.json('Redis ready.'));

function proxyCommand(name: string, ...arguments_: any[]): Promise<any> {
    return new Promise((resolve: any, reject: any) => {
        arguments_.push((error: any, ...results: any[]) => {
            // console.log(name);
            // console.log(arguments);
            // console.log(results);
            if (error) {
                reject(error, ...results);
            } else {
                resolve(...results);
            }
        });
        (client as any)[name].apply(client, arguments_);
    });
}

const keys: (pattern: string) => Promise<string[]> = proxyCommand.bind(undefined, 'keys');
const del = proxyCommand.bind(undefined, 'del');
const set = proxyCommand.bind(undefined, 'set');
const get = proxyCommand.bind(undefined, 'get');
const mget = proxyCommand.bind(undefined, 'mget');
const mset = proxyCommand.bind(undefined, 'mset');
const zadd = proxyCommand.bind(undefined, 'zadd');
const renameIfNotExists = proxyCommand.bind(undefined, 'renamenx');
const sortedSetSize = proxyCommand.bind(undefined, 'zcard');
const sortedSetGetByRange = proxyCommand.bind(undefined, 'zrange');
const sortedSetRemove = proxyCommand.bind(undefined, 'zrem');
const delWithPrefix = async (prefix: string): Promise<number> => {
    const keys = await RedisService.keys(prefix);
    if (keys.length === 0) return 0;
    for (const chunk of lodash.chunk(keys, 1000)) {
        await RedisService.del(...chunk);
    }
    return keys.length;
};

export const RedisService = {
    get,
    mget,
    set,
    mset,
    del,
    keys,
    zadd,
    renameIfNotExists,
    sortedSetSize,
    sortedSetGetByRange,
    sortedSetRemove,
    delWithPrefix,
};
