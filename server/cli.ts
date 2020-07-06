/* eslint-disable no-useless-constructor */
import { Service } from 'typedi';
import { APIServer } from './lib/api_server';
import { Redis, MySQL } from './infra';
import { BrokerAPI } from './lib/api';
import { DBService } from './lib/service';

@Service()
export class Cli {
    constructor(
        private db: MySQL,
        private apiServer: APIServer,
        private broker: BrokerAPI,
        private redis: Redis,
        private dbService: DBService,
    ) {}

    async dbInit(): Promise<void> {
        await this.db.init();
    }

    async startAPIServer(): Promise<void> {
        await this.apiServer.start();
    }

    async sync(): Promise<void> {
        console.log(`Syncing instruments...`);
        // const exchanges = await this.broker.getExchanges();
        // console.log(exchanges);
        const exchange = 'NSE';
        const instruments = await this.broker.getInstrumentsByExchange(exchange);
        await this.dbService.storeInstruments(exchange, instruments);
    }

    async debug(): Promise<void> {
        console.log(await this.redis.cacheDel('Broker.getProfle'));
    }
}
