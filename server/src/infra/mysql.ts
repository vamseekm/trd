/* eslint-disable no-useless-constructor */
import { Connection, createConnection } from 'typeorm';

import { logInfo } from '.';
import { configGet } from './config';
let _conn: Connection | undefined;

export async function mysqlConnect(): Promise<Connection> {
    if (_conn == undefined) {
        logInfo('Connecting to DB...');
        _conn = await createConnection(configGet('db', {}));
        return _conn;
    } else {
        return _conn;
    }
}
