/* eslint-disable no-useless-constructor */
import { Service } from 'typedi';
import { createConnection, Connection } from 'typeorm';
import { Config } from './config';

@Service()
export class MySQL {
    private conn?: Connection;

    constructor(private config: Config) {}

    async connection(): Promise<Connection> {
        if (!this.conn) {
            this.conn = await createConnection(await this.config.get('db', {}));
        }
        return this.conn;
    }

    async init(): Promise<void> {
        await this.connection();
    }
}
