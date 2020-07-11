/* eslint-disable no-useless-constructor */
import { Service } from 'typedi';
import { from } from 'rxjs';
import { concatMap, toArray, mergeMap } from 'rxjs/operators';
import { DBService } from './service';
import { BrokerAPI } from './api';

@Service()
export class Tasks {
    constructor(private dbService: DBService, private broker: BrokerAPI) {}

    async sync(): Promise<void> {
        const exchanges = (await this.broker.getExchanges()).filter((ex) => ex !== 'MF');
        console.log(exchanges);
        await from(exchanges)
            .pipe(
                concatMap(async (exchange) => {
                    try {
                        console.log(`Syncing exchange: ${exchange}`);
                        const instruments = await this.broker.getInstrumentsByExchange(exchange);
                        await this.dbService.storeInstruments(exchange, instruments);
                    } catch (err) {
                        console.log(err);
                    }
                }),
                toArray(),
            )
            .toPromise();
    }
}
