/* eslint-disable no-useless-constructor */
import { Service } from 'typedi';
import { getRepository, getConnection, In } from 'typeorm';
import { from } from 'rxjs';
import { concatMap, toArray } from 'rxjs/operators';
import { diff as deepDiff } from 'deep-diff';
import { Redis } from '../../infra';
import { Config } from '../entity/Config';
import { IInstrument } from '../types/instrument';
import { Instrument } from '../entity/Instrument';
import { diffListOfObjects, mapFromObjectList } from '../util';

@Service()
export class DBService {
    constructor(private redis: Redis) {}

    async configGet(key: string, defaultValue: string): Promise<string> {
        return this.redis.cachedGet({ key, expiry: 12 * 3600 * 1000 }, async () => {
            const configItem = await getRepository(Config)
                .createQueryBuilder('config')
                .where('config.key = :key', { key })
                .getOne();
            if (configItem) {
                const { value } = configItem;
                return value;
            }
            return defaultValue || '';
        });
    }

    async configSet(key: string, value: string): Promise<void> {
        await this.redis.cacheDel(key);
        await getConnection().query('INSERT INTO config VALUES (?, ?) ON DUPLICATE KEY UPDATE value = ?', [
            key,
            value,
            value,
        ]);
    }

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
            const { live, track, ...rest } = item;
            return rest;
        });
        const diff = diffListOfObjects(dbInstruments, inputInstruments, 'instrumentToken');
        console.log(`Instrument stats for exchange: ${exchange}`, diff.stats);
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
        if (diff.updated.length > 0) {
            try {
                await from(diff.updated)
                    .pipe(
                        concatMap(async (item) => {
                            return getRepository(Instrument)
                                .createQueryBuilder()
                                .update()
                                .set(inputInstrumentMap[item.instrumentToken])
                                .where('instrumentToken = :instrumentToken', { instrumentToken: item.instrumentToken })
                                .execute();
                        }),
                        toArray(),
                    )
                    .toPromise();
            } catch (err) {
                console.log(err);
            }
        }
    }
}
