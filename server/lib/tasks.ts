/* eslint-disable no-useless-constructor */
import { Service } from 'typedi';
import { from } from 'rxjs';
import { concatMap, toArray } from 'rxjs/operators';
import { DBService } from './service';
import { BrokerAPI } from './api';
import { Logger } from '../infra';

@Service()
export class Tasks {
    constructor(private dbService: DBService, private broker: BrokerAPI, private logger: Logger) {}

    async sync(): Promise<void> {
        const exchanges = (await this.broker.getExchanges()).filter((ex) => ex !== 'MF');
        this.logger.info({ exchanges });
        await from(exchanges)
            .pipe(
                concatMap(async (exchange) => {
                    try {
                        this.logger.info(`Syncing exchange: ${exchange}`);
                        const instruments = await this.broker.getInstrumentsByExchange(exchange);
                        await this.dbService.storeInstruments(exchange, instruments);
                    } catch (err) {
                        this.logger.error(err);
                    }
                }),
                toArray(),
            )
            .toPromise();
    }
}
