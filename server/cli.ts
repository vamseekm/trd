/* eslint-disable no-useless-constructor */
import { Service } from 'typedi';
import { APIServer } from './lib/api_server';
import { Redis, MySQL } from './infra';
import { BrokerAPI } from './lib/api';

@Service()
export class Cli {
    constructor(private db: MySQL, private apiServer: APIServer, private broker: BrokerAPI, private redis: Redis) {}

    async dbInit(): Promise<void> {
        await this.db.init();
    }

    async startAPIServer(): Promise<void> {
        await this.apiServer.start();
    }

    async debug(): Promise<void> {
        console.log(await this.redis.cacheDel('Broker.getProfle'));
    }
}
