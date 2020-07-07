/* eslint-disable no-useless-constructor */
import { Service } from 'typedi';
import { APIServer } from './lib/api_server';
import { MySQL } from './infra';
import { BrokerAPI } from './lib/api';
import { DBService } from './lib/service';
import { Tasks } from './lib/tasks';

@Service()
export class Cli {
    constructor(
        private db: MySQL,
        private apiServer: APIServer,
        private broker: BrokerAPI,
        private dbService: DBService,
        private tasks: Tasks,
    ) {}

    async dbInit(): Promise<void> {
        console.log('Initializing DB...');
        await this.db.init();
    }

    async startAPIServer(): Promise<void> {
        console.log('Starting API server...');
        await this.apiServer.start();
    }

    async sync(): Promise<void> {
        console.log(`Syncing instruments...`);
        return this.tasks.sync();
    }

    async debug(): Promise<void> {
        console.log(`Debug start.`);
    }
}
