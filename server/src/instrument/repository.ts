import { subHours } from 'date-fns';
import { Service } from 'typedi';
import { getRepository, InsertResult, UpdateResult } from 'typeorm';

import { Instrument, InstrumentMeta } from './entity';

@Service()
export class InstrumentRepository {
    async findInstrumentsBy(options: Partial<Instrument> = {}): Promise<Instrument[]> {
        return getRepository(Instrument).createQueryBuilder().where(options).getMany();
    }

    async insertInstrumentsBulk(instruments: Instrument[]): Promise<InsertResult> {
        return getRepository(Instrument).createQueryBuilder().insert().into('instrument').values(instruments).execute();
    }

    async updateInstrument(globalSymbol: string, data: Partial<Instrument>): Promise<UpdateResult> {
        return getRepository(Instrument).createQueryBuilder().update().set(data).where({ globalSymbol }).execute();
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

    async findMetaInstrumentsBy(options: { exchange?: string } = {}): Promise<InstrumentMeta[]> {
        return getRepository(InstrumentMeta).createQueryBuilder().where(options).getMany();
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
        const updatedAt = subHours(new Date(), 24);
        return getRepository(InstrumentMeta)
            .createQueryBuilder()
            .where('updatedAt < :updatedAt AND exchange = :exchange', { updatedAt, exchange })
            .getMany();
    }

    async upsertMetaInstrument(globalSymbol: string, data: Partial<InstrumentMeta>): Promise<any> {
        if ((await getRepository(InstrumentMeta).count({ globalSymbol })) === 0) {
            return getRepository(InstrumentMeta).createQueryBuilder().insert().values(data).execute();
        } else {
            return getRepository(InstrumentMeta)
                .createQueryBuilder()
                .update(InstrumentMeta)
                .set(data)
                .where({ globalSymbol })
                .execute();
        }
    }
}
