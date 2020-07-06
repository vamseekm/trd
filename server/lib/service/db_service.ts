/* eslint-disable no-useless-constructor */
import { Service } from 'typedi';
import { getRepository, getConnection } from 'typeorm';
import { from } from 'rxjs';
import { reduce, map, partition, toArray } from 'rxjs/operators';
import { stringify } from 'querystring';
import { util } from 'config';
import { MySQL, Redis } from '../../infra';
import { Config } from '../entity/Config';
import { IInstrument } from '../types/instrument';
import { Instrument } from '../entity/Instrument';
import { objectArrayToMap, arrayToMap } from '../util';

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
        await getConnection().query('INSERT INTO config_model VALUES (?, ?) ON DUPLICATE KEY UPDATE value = ?', [
            key,
            value,
            value,
        ]);
    }

    async insertInstrument(instrument: IInstrument): Promise<IInstrument> {
        await getRepository(Instrument).createQueryBuilder().insert().into(Instrument).values(instrument).execute();
        return instrument;
    }

    async storeInstruments(exchange: string, inputInstruments: IInstrument[]): Promise<void> {
        const inputInstrumentsMap = await objectArrayToMap(inputInstruments, 'instrumentToken');
        const inputInstrumentIdMap = await arrayToMap(Object.keys(inputInstrumentsMap));
        /*
        const inputInstrumentsMap = inputInstruments
            .filter((item) => item.instrumentToken && item.instrumentToken.length > 0)
            .reduce((map, item) => {
                map[item.instrumentToken] = item;
                return map;
            }, {} as Record<string, IInstrument>);
        const dbIds: Record<string, boolean> = (
            await getRepository(Instrument)
                .createQueryBuilder('instrument')
                .select(['instrument.instrumentToken as instrumentToken'])
                .getRawMany()
        ).reduce(function (map: Record<string, boolean>, row: { instrumentToken: string }) {
            // eslint-disable-next-line no-param-reassign
            map[row.instrumentToken] = true;
            return map;
        }, {});

        const [updateStream, insertStream] = partition((item: IInstrument) => dbIds[item.instrumentToken])(
            from(inputInstruments),
        );
        const updates = await updateStream.pipe(toArray()).toPromise();
        const inserts = await insertStream.pipe(toArray()).toPromise();
        console.log('updates: ', updates.length);
        console.log('inserts: ', inserts.length);
        console.log(inserts);

        const insts = await from(instruments)
            .pipe(
                tap((ins) => console.log(ins)),
                flatMap(this.insertInstrument.bind(this)),
                toArray(),
            )
            .toPromise();
        console.log(insts);
        */
    }
}
