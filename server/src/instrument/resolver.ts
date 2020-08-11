import { Arg, Query, Resolver } from 'type-graphql';
import { Service } from 'typedi';

import { Instrument } from './entity';
import { InstrumentRepository } from './repository';
import { InstrumentService } from './service';

@Service()
@Resolver()
export class InstrumentResolver {
    constructor(private instrumentSvc: InstrumentService, private instrumentRepo: InstrumentRepository) {}

    @Query((returns) => [Instrument])
    async searchInstruments(): Promise<Instrument[]> {
        return [];
    }

    @Query((returns) => Instrument)
    async instrumentByGlobalSymbol(@Arg('symbol') globalSymbol: string): Promise<Instrument> {
        const instruments = await this.instrumentRepo.findInstrumentsBy({ search: { globalSymbol } });
        if (!instruments) {
            throw new Error('Instrument not found');
        }
        return instruments[0];
    }

    @Query((returns) => [Instrument])
    async instrumentsByExchange(@Arg('exchange') exchange: string): Promise<Instrument[]> {
        const instruments = await this.instrumentRepo.findInstrumentsBy({ search: { exchange } });
        if (instruments.length === 0) throw new Error('Empty exchange');
        return instruments;
    }

    @Query((returns) => [String])
    async exchangeList(): Promise<string[]> {
        return this.instrumentRepo.exchangeList();
    }
}
