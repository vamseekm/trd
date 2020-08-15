/* eslint-disable no-useless-constructor */
import { Service } from 'typedi';
import { Connection, createConnection } from 'typeorm';

import { Config } from './config';
import { LoggerService } from './logger';

@Service()
export class MySQLService {
    private conn?: Connection;

    constructor(private config: Config, private logger: LoggerService) {}

    async connect(): Promise<Connection> {
        if (!this.conn) {
            this.logger.info('Connecting to DB...');
            this.conn = await createConnection(this.config.get('db', {}));
        }
        return this.conn;
    }
}
