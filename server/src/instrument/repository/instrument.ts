import { diff as diffObject } from 'deep-diff';
import { FindOptions, Op, WhereOptions } from 'sequelize';

import { InstrumentModel } from '../../database';
import { Log } from '../../infra';
import { IInstrument, UpsertResults } from '../../types';
import { diffListOfObjects, mapFromObjectList } from '../../util';
async function fetchFnoInstruments({
    name,
    exchange = 'NFO',
    segment = 'NFO-FUT',
    expiry = new Date(),
    take,
}: {
    name: string;
    exchange?: string;
    segment?: string;
    expiry?: Date;
    take?: number;
}): Promise<IInstrument[]> {
    let options: FindOptions = { where: { name, exchange, segment, expiry: { [Op.gte]: expiry } }, raw: true };
    if (take != undefined) options = { ...options, limit: take };
    return InstrumentModel.findAll(options);
}

async function fetchOptions(name: string): Promise<IInstrument[]> {
    return InstrumentModel.findAll({
        where: { name, exchange: 'NFO', segment: 'NFO-OPT', live: true },
        order: [['expiry', 'ASC']],
    });
}

async function findTopInstruments({ exchange, take }: { exchange: string; take: number }): Promise<IInstrument[]> {
    return InstrumentModel.findAll({ where: { exchange }, order: [['rank', 'ASC']], limit: take });
}

async function updateInstrument({ id, ...rest }: Partial<IInstrument>): Promise<any> {
    if (id == undefined) throw new Error(`id can't be undefined.`);
    return InstrumentModel.update(rest, { where: { id } });
}

async function updateInstruments(instrumentList: Array<Partial<IInstrument>>): Promise<any> {
    return await Promise.all(
        instrumentList.map((instrument: Partial<IInstrument>) => {
            return updateInstrument(instrument);
        }),
    );
}

async function bulkUpdateInstruments(idList: string[], data: Partial<IInstrument>) {
    return InstrumentModel.update(data, { where: { id: { [Op.in]: idList } } });
}

async function trackInstruments(idList: string[]): Promise<any> {
    return bulkUpdateInstruments(idList, { track: true });
}

async function exchangeList(): Promise<string[]> {
    return InstrumentModel.aggregate('exchange', 'distinct');
    // return InstrumentModel.distinct('exchange').exec();
}

async function upsertInstruments(exchange: string, inputInstruments: IInstrument[]): Promise<UpsertResults> {
    const databaseInstruments: IInstrument[] = (await InstrumentModel.findAll({ where: { exchange }, raw: true })).map(
        (item) => {
            const { createdAt, updatedAt, lastPriceUpdatedOn, track, rank, ...rest } = item;
            return { ...rest, lastPrice: 0 };
        },
    );
    const diff = diffListOfObjects(databaseInstruments, inputInstruments, 'id');
    const removedSymbols = diff.removed.map((item) => item.id);
    if (removedSymbols.length > 0) {
        Log.info(`\tRemoved: ${removedSymbols.length}`);
        await bulkUpdateInstruments(removedSymbols, { live: false });
    }
    const inputInstrumentMap = await mapFromObjectList(inputInstruments, 'id');
    if (diff.updated.length > 0) {
        Log.info('\tUpdating...');
        const databaseInstrumentsMap = await mapFromObjectList(databaseInstruments, 'id');
        console.log(diffObject(diff.updated[0], databaseInstrumentsMap.get(diff.updated[0].id)));
        await updateInstruments(
            diff.updated.map((instrument) => {
                return { ...inputInstrumentMap.get(instrument.id), live: true };
            }),
        );
    }
    if (diff.added.length > 0) {
        Log.info('\tInserting...');
        await InstrumentModel.bulkCreate(
            diff.added.map((instrument: IInstrument) => ({
                ...instrument,
                rank: 0,
                live: true,
                track: false,
                lastPriceUpdatedOn: new Date(0),
            })),
        );
    }
    return {
        insert: diff.added.length,
        update: diff.updated.length,
        remove: diff.removed.length,
    };
}

async function findOneBy(where: WhereOptions): Promise<IInstrument | null> {
    return InstrumentModel.findOne({ where, raw: true });
}

export const InstrumentRepository = {
    exchangeList,
    fetchFnoInstruments,
    fetchOptions,
    findTopInstruments,
    upsertInstruments,
    trackInstruments,
    updateInstruments,
    findOneBy,
};
