/* eslint-disable no-useless-constructor */
import { Service } from 'typedi';
import { from } from 'rxjs';
import { concatMap, toArray } from 'rxjs/operators';
import { Logger } from '../../infra';
import { BrokerService } from '../broker';
import { InstrumentService } from '../instrument';

@Service()
export class TaskService {
    constructor(private brokerSvc: BrokerService, private instrumentSvc: InstrumentService, private logger: Logger) { }

    async sync(): Promise<void> {
        await this.syncMeta();
        await this.syncInstruments();
    }

    async syncMeta(): Promise<void> {
        console.log('Syncing meta...');
    }

    async syncInstruments(): Promise<void> {
        const exchanges = (await this.brokerSvc.getExchanges()).filter((ex) => ex !== 'MF');
        this.logger.info({ exchanges });
        await from(exchanges)
            .pipe(
                concatMap(async (exchange) => {
                    try {
                        this.logger.info(`Syncing exchange: ${exchange}`);
                        const instruments = await this.brokerSvc.getInstrumentsByExchange(exchange);
                        await this.instrumentSvc.storeInstruments(exchange, instruments);
                    } catch (err) {
                        this.logger.error(err);
                    }
                }),
                toArray(),
            )
            .toPromise();
    }
}
