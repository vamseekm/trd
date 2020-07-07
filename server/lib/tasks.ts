/* eslint-disable no-useless-constructor */
import { Service } from 'typedi';
import { DBService } from './service';
import { BrokerAPI } from './api';

@Service()
export class Tasks {
    constructor(private dbService: DBService, private broker: BrokerAPI) {}

    async sync(): Promise<void> {
        const exchange = 'NSE';
        const instruments = await this.broker.getInstrumentsByExchange(exchange);
        await this.dbService.storeInstruments(exchange, instruments);
    }
}
