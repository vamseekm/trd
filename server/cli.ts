/* eslint-disable no-useless-constructor */
import { Service } from 'typedi';
import { APIServer, DB } from './infra';
import { Config } from './infra/config';

@Service()
export class Cli {
    constructor(private config: Config, private db: DB, private apiServer: APIServer) {}

    async startAPIServer(): Promise<void> {
        await this.db.init();
        await this.apiServer.start();
    }
}
