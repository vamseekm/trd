/* eslint-disable unicorn/no-fn-reference-in-iterator */
import { subHours } from 'date-fns';
import { CLIENT_RENEG_LIMIT } from 'tls';
import { Service } from 'typedi';
import { getRepository, InsertResult, UpdateResult } from 'typeorm';

import { Instrument, InstrumentMeta, SymbolMap } from './entity';

@Service()
export class InstrumentRepository {
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

    async insertInstruments(instruments: Instrument[]): Promise<InsertResult> {
        return getRepository(Instrument).createQueryBuilder().insert().into('instrument').values(instruments).execute();
    }

    async upsertInstrument(globalSymbol: string, instrument: Partial<Instrument>): Promise<void> {
        const instrumentRepo = getRepository(Instrument);
        const { id } = await this.generateSymbol(globalSymbol);
        const instrumentRow = await instrumentRepo.findOne({ globalSymbol });
        if (!instrumentRow) {
            await instrumentRepo.save(instrumentRepo.create({ ...instrument, id }));
        } else {
            await instrumentRepo.update({ globalSymbol }, { ...instrument, id });
        }
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

    async findMetaInstrumentsBy(options: Partial<InstrumentMeta> = {}): Promise<InstrumentMeta[]> {
        return getRepository(InstrumentMeta).find(options);
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

    async generateSymbol(globalSymbol: string): Promise<SymbolMap> {
        const symbolRepo = getRepository(SymbolMap);
        const symbol = await symbolRepo.findOne({ globalSymbol });
        if (symbol) return symbol;
        await symbolRepo.insert({ globalSymbol });
        return (symbolRepo.findOne({ globalSymbol }) as unknown) as SymbolMap;
    }
}
