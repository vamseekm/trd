/* eslint-disable no-useless-constructor */
import { Service } from 'typedi';
import { getRepository } from 'typeorm';
import { from } from 'rxjs';
import { toArray, mergeMap } from 'rxjs/operators';
import { Redis, Logger } from '../../infra';
import { IInstrument } from '../../types';
import { Instrument } from './entity';
import { diffListOfObjects, mapFromObjectList } from '../util';

@Service()
export class InstrumentService {
    constructor(private redis: Redis, private logger: Logger) { }

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
        const dbInstruments: IInstrument[] = (await this.getInstrumentsByExchange(exchange)).map((item) => {
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const { live, track, rank, ...rest } = item;
            return rest;
        });
        const diff = diffListOfObjects(dbInstruments, inputInstruments, 'instrumentToken');
        this.logger.info(`Instrument stats for exchange: ${exchange}`, diff.stats);
        const removedIds = diff.removed.map((item) => item.instrumentToken);
        if (removedIds.length > 0) {
            await getRepository(Instrument)
                .createQueryBuilder()
                .update()
                .set({ live: false })
                .where('instrumentToken IN (:tokens)', { tokens: removedIds })
                .execute();
        }
        if (diff.added.length > 0) {
            await getRepository(Instrument)
                .createQueryBuilder()
                .insert()
                .into('instrument')
                .values(diff.added)
                .execute();
        }
        const inputInstrumentMap = await mapFromObjectList(inputInstruments, 'instrumentToken');
        // const dbInstrumentMap = await mapFromObjectList(dbInstruments, 'instrumentToken');
        if (diff.updated.length > 0) {
            try {
                await from(diff.updated)
                    .pipe(
                        mergeMap(async (item) => {
                            // this.logger.info(
                            //     `Diff between downloaded instrument & dbInstrument for exchange: ${exchange}`,
                            //     deepDiff(
                            //         dbInstrumentMap[item.instrumentToken],
                            //         inputInstrumentMap[item.instrumentToken],
                            //     ),
                            // );
                            return getRepository(Instrument)
                                .createQueryBuilder()
                                .update()
                                .set(inputInstrumentMap[item.instrumentToken])
                                .where('instrumentToken = :instrumentToken', { instrumentToken: item.instrumentToken })
                                .execute();
                        }, 4),
                        toArray(),
                    )
                    .toPromise();
            } catch (err) {
                this.logger.error(err);
            }
        }
    }
}
