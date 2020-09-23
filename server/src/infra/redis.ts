/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-var-requires */
/* eslint-disable no-useless-constructor */
import redis from 'redis';

import { Config } from './config';
import { Log } from './logger';

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

export const RedisService = {
    get,
    set,
    del,
};
