import { subHours } from 'date-fns';
import { getRepository } from 'typeorm';

import { Instrument, InstrumentMeta } from '../entity';
import { SymbolMapRepository } from './symbol-map';

// async function fetchInstrumentMetaList(globalSymbolList: string[]): Promise<InstrumentMeta[]> {
//     return getRepository(InstrumentMeta)
//         .createQueryBuilder()
//         .where('globalSymbol IN(:...globalSymbolList)', { globalSymbolList })
//         .getMany();
// }

async function findMetaInstrumentsBy(options: Partial<InstrumentMeta> = {}): Promise<InstrumentMeta[]> {
    return getRepository(InstrumentMeta).find(options || {});
}

async function findMetaInstrumentsNotPresent(exchange: string): Promise<Instrument[]> {
    const nseInstruments = await findMetaInstrumentsBy({ exchange });
    const globalSymbols = nseInstruments.map((instrument) => instrument.globalSymbol);
    const where =
        globalSymbols.length > 0
            ? 'globalSymbol NOT IN (:...globalSymbols) AND exchange = :exchange'
            : 'exchange = :exchange';
    return getRepository(Instrument)
        .createQueryBuilder()
        .where(where, {
            globalSymbols,
            exchange,
        })
        .getMany();
}

async function findMetaInstrumentsOutdated(exchange: string): Promise<InstrumentMeta[]> {
    const updatedAt = subHours(new Date(), 5 * 24);
    return getRepository(InstrumentMeta)
        .createQueryBuilder()
        .where('updatedAt < :updatedAt AND exchange = :exchange', {
            updatedAt,
            exchange,
        })
        .getMany();
}

async function upsertMetaInstrument(globalSymbol: string, data: Partial<InstrumentMeta>): Promise<void> {
    const instrumentRepo = getRepository(InstrumentMeta);
    const { id } = await SymbolMapRepository.generateSymbol(globalSymbol);
    if ((await instrumentRepo.count({ id })) === 0) {
        instrumentRepo.save(instrumentRepo.create({ ...data, id }));
    } else {
        instrumentRepo.update({ id }, data);
    }
}

export const InstrumentMetaRepository = {
    findMetaInstrumentsBy,
    upsertMetaInstrument,
    findMetaInstrumentsNotPresent,
    findMetaInstrumentsOutdated,
};
