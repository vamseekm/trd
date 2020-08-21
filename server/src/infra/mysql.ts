/* eslint-disable no-useless-constructor */
import { Connection, createConnection } from 'typeorm';

import { Log } from '.';
import { Config } from './config';
let _conn: Connection | undefined;

async function connect(): Promise<Connection> {
    if (_conn == undefined) {
        Log.info('Connecting to DB...');
        _conn = await createConnection(Config.get('db', {}));
        return _conn;
    } else {
        return _conn;
    }
}

export const MySQL = {
    connect,
};
