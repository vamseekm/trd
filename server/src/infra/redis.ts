/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-var-requires */
/* eslint-disable no-useless-constructor */
import redis from 'redis';

import { Config } from './config';
import { Log } from './logger';

const client = redis.createClient(Config.get('redis'));
client.on('error', (error) => Log.error(error));
client.on('reconnecting', (info) => Log.json("Redis reconnecting", info));
client.on('connect', () => Log.json("Redis connected."));
client.on('ready', () => Log.json("Redis ready."));

function proxyCommand(name: string, ...arguments_: any[]): Promise<any> {
    // console.log(name, arguments_);
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

function collectArguments(name: string, ...arguments_: any[]): Promise<any> {
    return proxyCommand(name, arguments_);
}

const keys: (pattern: string) => Promise<string[]> = proxyCommand.bind(null, 'keys');
const del = proxyCommand.bind(null, 'del');
const set = proxyCommand.bind(null, 'set');
const get = proxyCommand.bind(null, 'get');

export const RedisService = {
    get,
    set,
    del,
    keys,
};
