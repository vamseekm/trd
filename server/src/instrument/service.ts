/* eslint-disable no-useless-constructor */
import deepDiff from 'deep-diff';
import { from } from 'rxjs';
import { concatMap, mergeMap, toArray } from 'rxjs/operators';
import { Service } from 'typedi';
import { getRepository } from 'typeorm';

import { BrokerService } from '../broker';
import { LoggerService, Redis } from '../infra';
import { IInstrument } from '../types';
import { diffListOfObjects, mapFromObjectList } from '../util';
import { Instrument } from './entity';

@Service()
export class InstrumentService {
    constructor(private logger: LoggerService, private brokerSvc: BrokerService) { }

    async insertInstrument(instrument: IInstrument): Promise<IInstrument> {
        await getRepository(Instrument).createQueryBuilder().insert().into(Instrument).values(instrument).execute();
        return instrument;
    }

    async getInstrumentsByExchange(exchange: string): Promise<Instrument[]> {
        return getRepository(Instrument)
            .createQueryBuilder('instrument')
            .where('instrument.exchange = :exchange', { exchange })
            .getMany();
    }

    async storeInstruments(exchange: string, inputInstruments: IInstrument[]): Promise<void> {
        const databaseInstruments: IInstrument[] = (await this.getInstrumentsByExchange(exchange)).map((item) => {
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const { id, live, track, rank, updatedAt, createdAt, ...rest } = item;
            return rest;
        });
        const diff = diffListOfObjects(databaseInstruments, inputInstruments, 'globalSymbol');
        this.logger.info(`Instrument stats for exchange: ${exchange}`, diff.stats);
        const removedSymbols = diff.removed.map((item) => item.globalSymbol);
        this.logger.info(`Disabling ... ${removedSymbols.length}`);
        if (removedSymbols.length > 0) {
            await getRepository(Instrument)
                .createQueryBuilder()
                .update()
                .set({ live: false })
                .where('globalSymbol IN (:globalSymbols)', { globalSymbols: removedSymbols })
                .execute();
        }
        const inputInstrumentMap = await mapFromObjectList(inputInstruments, 'globalSymbol');
        const databaseInstrumentMap = await mapFromObjectList(databaseInstruments, 'globalSymbol');
        this.logger.info(`Updating ... ${diff.updated.length}`);
        if (diff.updated.length > 0) {
            try {
                await from(diff.updated)
                    .pipe(
                        mergeMap(async (item) => {
                            this.logger.json({
                                message: `Diff between downloaded instrument & dbInstrument for exchange: ${exchange}`,
                                diff: deepDiff.diff(
                                    databaseInstrumentMap[item.globalSymbol],
                                    inputInstrumentMap[item.globalSymbol],
                                ),
                            });
                            return getRepository(Instrument)
                                .createQueryBuilder()
                                .update()
                                .set({ ...inputInstrumentMap[item.globalSymbol], live: true })
                                .where('globalSymbol = :globalSymbol', { globalSymbol: item.globalSymbol })
                                .execute();
                        }, 4),
                        toArray(),
                    )
                    .toPromise();
            } catch (error) {
                this.logger.error(error);
            }
        }
        this.logger.info(`Inserting ... ${diff.added.length}`);
        if (diff.added.length > 0) {
            await getRepository(Instrument)
                .createQueryBuilder()
                .insert()
                .into('instrument')
                .values(diff.added)
                .execute();
        }
    }

    async syncInstruments(): Promise<void> {
        const exchanges = (await this.brokerSvc.getExchanges()).filter((ex) => ex !== 'MF');
        this.logger.json({ exchanges });
        await from(exchanges)
            .pipe(
                concatMap(async (exchange) => {
                    try {
                        this.logger.info(`Syncing exchange: ${exchange}`);
                        const instruments = await this.brokerSvc.getInstrumentsByExchange(exchange);
                        await this.storeInstruments(exchange, instruments);
                    } catch (error) {
                        this.logger.error(error);
                    }
                }),
                toArray(),
            )
            .toPromise();
    }
}
