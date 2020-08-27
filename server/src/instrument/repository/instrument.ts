import { getRepository, UpdateResult } from 'typeorm';

import { Instrument } from '../entity';

async function findInstrumentsBy({
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

async function fetchFutures(name: string): Promise<Instrument[]> {
    return await findInstrumentsBy({
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

async function findTopInstruments({ exchange, limit }: { exchange: string; limit: number }): Promise<Instrument[]> {
    return getRepository(Instrument)
        .createQueryBuilder()
        .where({ exchange })
        .orderBy('rank', 'ASC')
        .limit(limit)
        .getMany();
}

async function insertInstruments(instruments: Partial<Instrument>[]): Promise<any> {
    // return getRepository(Instrument).insert(inserts);
    await getRepository(Instrument)
        .createQueryBuilder()
        .insert()
        .into('instrument')
        .values(instruments)
        .updateEntity(false)
        .execute();
    return true;
}

async function updateInstruments(instrumentList: Array<Partial<Instrument>>): Promise<UpdateResult[]> {
    const instrumentRepo = getRepository(Instrument);
    return Promise.all(
        instrumentList.map((instrument: Partial<Instrument>) => {
            const { globalSymbol } = instrument;
            return instrumentRepo.update({ globalSymbol }, instrument);
        }),
    );
}

async function markInstrumentsRemoved(globalSymbols: string[]): Promise<UpdateResult> {
    return getRepository(Instrument)
        .createQueryBuilder()
        .update()
        .set({ live: false })
        .where('globalSymbol IN (:globalSymbols)', { globalSymbols })
        .execute();
}

async function exchangeList(): Promise<string[]> {
    const instruments = await getRepository(Instrument)
        .createQueryBuilder()
        .select('exchange')
        .distinct(true)
        .where({ live: true })
        .getRawMany();
    return instruments.map((instrument: Instrument) => instrument.exchange);
}

export const InstrumentRepository = {
    findInstrumentsBy,
    updateInstruments,
    insertInstruments,
    markInstrumentsRemoved,
    fetchFutures,
    findTopInstruments,
    exchangeList,
};
