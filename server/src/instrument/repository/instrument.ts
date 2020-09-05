import { DocumentType } from '@typegoose/typegoose';
import { diff as diffObject } from 'deep-diff';

import { IInstrument, UpsertResults } from '../../types';
import { diffListOfObjects, mapFromObjectList } from '../../util';
import { InstrumentClass, InstrumentModel } from '../model';

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
}): Promise<InstrumentClass[]> {
    let query = InstrumentModel.find({ name, exchange, segment, expiry: { $gte: expiry } }).sort({ expiry: 1 });
    if (take != undefined) query = query.limit(take);
    return query;
}

async function fetchOptions(name: string): Promise<InstrumentClass[]> {
    return InstrumentModel.find({ name, exchange: 'NFO', segment: 'NFO-OPT', live: true }).sort({ expiry: 1 });
}

async function findTopInstruments({ exchange, take }: { exchange: string; take: number }): Promise<InstrumentClass[]> {
    return InstrumentModel.find({ exchange }).sort({ rank: 1 }).limit(take);
}

async function updateInstrument({ globalSymbol, ...rest }: Partial<InstrumentClass>): Promise<void> {
    if (globalSymbol == undefined) throw new Error(`globalSymbol can't be undefined.`);
    return InstrumentModel.updateOne({ globalSymbol }, rest);
}

async function updateInstruments(instrumentList: Array<Partial<InstrumentClass>>): Promise<void> {
    await Promise.all(
        instrumentList.map((instrument: Partial<InstrumentClass>) => {
            return updateInstrument(instrument);
        }),
    );
}

async function trackInstruments(globalSymbolList: string[]): Promise<void> {
    return InstrumentModel.updateMany({ globalSymbol: { $in: globalSymbolList } }, { track: true }, { multi: true });
    // return prisma.instrument.update({ where: { globalSymbol }, data: { track: true } });
}

async function exchangeList(): Promise<string[]> {
    return InstrumentModel.distinct('exchange').exec();
}

async function upsertInstruments(exchange: string, inputInstruments: IInstrument[]): Promise<UpsertResults> {
    const databaseInstruments: IInstrument[] = (await InstrumentModel.find({ exchange })).map(
        (item: DocumentType<InstrumentClass>) => {
            const {
                _id,
                _v,
                __v,
                id,
                lastPrice,
                lastPriceUpdatedOn,
                live,
                track,
                rank,
                createdAt,
                updatedAt,
                ...rest
            } = item.toObject();
            return { ...rest, lastPrice: 0 };
        },
    );
    const diff = diffListOfObjects(databaseInstruments, inputInstruments, 'globalSymbol');
    const removedSymbols = diff.removed.map((item) => item.globalSymbol);
    if (removedSymbols.length > 0) {
        await updateInstruments(
            removedSymbols.map((globalSymbol) => {
                return { globalSymbol, live: false };
            }),
        );
    }
    const inputInstrumentMap = await mapFromObjectList(inputInstruments, 'globalSymbol');
    if (diff.updated.length > 0) {
        const databaseInstrumentsMap = await mapFromObjectList(databaseInstruments, 'globalSymbol');
        console.log(diffObject(diff.updated[0], databaseInstrumentsMap[diff.updated[0].globalSymbol]));
        await updateInstruments(
            diff.updated.map((instrument) => {
                return { ...inputInstrumentMap[instrument.globalSymbol], live: true };
            }),
        );
    }
    if (diff.added.length > 0) {
        await InstrumentModel.create(
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

export const InstrumentRepository = {
    exchangeList,
    fetchFnoInstruments,
    fetchOptions,
    // findInstrumentsBy,
    findTopInstruments,
    upsertInstruments,
    trackInstruments,
    updateInstruments,
};
