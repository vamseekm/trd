import { subHours } from 'date-fns';
import lodash from 'lodash';
import { Service } from 'typedi';
import { getRepository } from 'typeorm';

import { Instrument, InstrumentMeta, SymbolMap } from '../entity';

@Service()
export class InstrumentMetaRepository {
    async generateSymbol(globalSymbol: string): Promise<SymbolMap> {
        const symbolRepo = getRepository(SymbolMap);
        const symbol = await symbolRepo.findOne({ globalSymbol });
        if (symbol) return symbol;
        await symbolRepo.insert({ globalSymbol });
        return (symbolRepo.findOne({ globalSymbol }) as unknown) as SymbolMap;
    }

    async fetchInstrumentMetaList(globalSymbolList: string[]): Promise<InstrumentMeta[]> {
        return getRepository(InstrumentMeta)
            .createQueryBuilder()
            .where('globalSymbol IN(:...globalSymbolList)', { globalSymbolList })
            .getMany();
    }

    async findMetaInstrumentsBy(options: Partial<InstrumentMeta> = {}): Promise<InstrumentMeta[]> {
        return getRepository(InstrumentMeta).find(options || {});
    }

    async findMetaInstrumentsNotPresent(exchange: string): Promise<Instrument[]> {
        const nseInstruments = await this.findMetaInstrumentsBy({ exchange });
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

    async findMetaInstrumentsOutdated(exchange: string): Promise<InstrumentMeta[]> {
        const updatedAt = subHours(new Date(), 5 * 24);
        return getRepository(InstrumentMeta)
            .createQueryBuilder()
            .where('updatedAt < :updatedAt AND exchange = :exchange', {
                updatedAt,
                exchange,
            })
            .getMany();
    }

    async upsertMetaInstrument(globalSymbol: string, data: Partial<InstrumentMeta>): Promise<void> {
        const instrumentRepo = getRepository(InstrumentMeta);
        const { id } = await this.generateSymbol(globalSymbol);
        if ((await instrumentRepo.count({ id })) === 0) {
            instrumentRepo.save(instrumentRepo.create({ ...data, id }));
        } else {
            instrumentRepo.update({ id }, data);
        }
    }
}
