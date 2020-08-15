/* eslint-disable unicorn/no-fn-reference-in-iterator */
import { Service } from 'typedi';
import { getRepository, InsertResult, UpdateResult } from 'typeorm';

import { Instrument } from '../entity';
import { InstrumentMetaRepository } from './instrument-meta';
import { SymbolMapRepository } from './symbol-map';

@Service()
export class InstrumentRepository {
    constructor(private instrumentMetaRepo: InstrumentMetaRepository, private symbolMapRepo: SymbolMapRepository) {}
    async findInstrumentsBy({
        search,
        order,
        limit,
        offset,
    }: {
        search?: Partial<Instrument>;
        order?: { by?: keyof Instrument; sort?: 'ASC' | 'DESC' };
        limit?: number;
        offset?: number;
    }): Promise<Instrument[]> {
        const query = getRepository(Instrument).createQueryBuilder();
        if (search != undefined) query.where({ live: true, ...search });
        if (order != undefined && order.by != undefined) query.orderBy(order.by, order.sort || 'ASC');
        if (offset != undefined) query.limit(offset);
        if (limit != undefined) query.limit(limit);
        return query.getMany();
    }

    async fetchFutures(name: string): Promise<Instrument[]> {
        return await this.findInstrumentsBy({
            search: {
                name,
                exchange: 'NFO',
                segment: 'NFO-FUT',
            },
            order: {
                by: 'expiry',
            },
        });
    }

    async findTopInstruments({ exchange, limit }: { exchange: string; limit: number }): Promise<Instrument[]> {
        return getRepository(Instrument)
            .createQueryBuilder()
            .where({ exchange })
            .orderBy('rank', 'ASC')
            .limit(limit)
            .getMany();
    }

    async insertInstruments(instruments: Partial<Instrument>[]): Promise<any> {
        const symbolMap = await this.symbolMapRepo.generateSymbolMap(
            instruments.map((instrument) => {
                if (instrument.globalSymbol == undefined) throw new Error("globalSymbol can't be null");
                return instrument.globalSymbol;
            }),
        );
        const inserts = instruments.map((instrument: Partial<Instrument>) => {
            const { globalSymbol } = instrument;
            if (globalSymbol == undefined) {
                throw new Error("globalSymbol can't be null");
            }
            const id = symbolMap[globalSymbol].id;
            return { ...instrument, id };
        });
        // return getRepository(Instrument).insert(inserts);
        await getRepository(Instrument)
            .createQueryBuilder()
            .insert()
            .into('instrument')
            .values(inserts)
            .updateEntity(false)
            .execute();
        return true;
    }

    async updateInstruments(instrumentList: Array<Partial<Instrument>>): Promise<UpdateResult[]> {
        const instrumentRepo = getRepository(Instrument);
        return Promise.all(
            instrumentList.map((instrument: Partial<Instrument>) => {
                const { globalSymbol } = instrument;
                return instrumentRepo.update({ globalSymbol }, instrument);
            }),
        );
    }

    async markInstrumentsRemoved(globalSymbols: string[]): Promise<UpdateResult> {
        return getRepository(Instrument)
            .createQueryBuilder()
            .update()
            .set({ live: false })
            .where('globalSymbol IN (:globalSymbols)', { globalSymbols })
            .execute();
    }

    async exchangeList(): Promise<string[]> {
        const instruments = await getRepository(Instrument)
            .createQueryBuilder()
            .select('exchange')
            .distinct(true)
            .where({ live: true })
            .getRawMany();
        return instruments.map((instrument: Instrument) => instrument.exchange);
    }
}
