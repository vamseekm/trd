/* eslint-disable no-useless-constructor */
import { Service } from 'typedi';
import { createConnection, Connection } from 'typeorm';
import { Config } from './config';
import { Logger } from './logger';

@Service()
export class MySQL {
    private conn?: Connection;

    constructor(private config: Config, private logger: Logger) { }

    async connection(): Promise<Connection> {
        if (!this.conn) {
            this.logger.info('Connecting to DB...');
            this.conn = await createConnection(this.config.get('db', {}));
        }
        return this.conn;
    }

    async init(): Promise<void> {
        await this.connection();
    }
}
