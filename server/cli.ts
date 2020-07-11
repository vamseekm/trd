/* eslint-disable no-useless-constructor */
import { Service } from 'typedi';
import { memoryUsage } from 'process';
import moment from 'moment';

import { APIServer } from './lib/api_server';
import { MySQL } from './infra';
import { BrokerAPI } from './lib/api';
import { DBService } from './lib/service';
import { Tasks } from './lib/tasks';
import { Logger } from './infra/logger';

@Service()
export class Cli {
    constructor(
        private db: MySQL,
        private apiServer: APIServer,
        private broker: BrokerAPI,
        private dbService: DBService,
        private tasks: Tasks,
        private logger: Logger,
    ) {}

    setup() {}

    async dbInit(): Promise<void> {
        this.logger.info('Initializing DB...');
        await this.db.init();
    }

    async startAPIServer(): Promise<void> {
        this.logger.info('Starting API server...');
        await this.apiServer.start();
    }

    async sync(): Promise<void> {
        this.logger.info(`Syncing instruments...`);
        return this.tasks.sync();
    }

    async debug(): Promise<void> {
        this.logger.info(`Debug start.`);
    }
}
