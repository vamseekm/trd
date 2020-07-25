import { Arg, Query, Resolver } from 'type-graphql';
import { Service } from 'typedi';

import { Instrument } from './entity';
import { InstrumentService } from './service';

@Service()
@Resolver()
export class InstrumentResolver {
    constructor(private instrumentSvc: InstrumentService) {}

    @Query((returns) => [Instrument])
    async searchInstruments(): Promise<Instrument[]> {
        return [];
    }

    @Query((returns) => Instrument)
    async instrumentByGlobalSymbol(@Arg('symbol') globalSymbol: string): Promise<Instrument> {
        const instrument = await this.instrumentSvc.findByGlobalSymbol(globalSymbol);
        if (!instrument) {
            throw new Error('Instrument not found');
        }
        return instrument;
    }

    @Query((returns) => [Instrument])
    async instrumentsByExchange(@Arg('exchange') exchange: string): Promise<Instrument[]> {
        const instruments = await this.instrumentSvc.findByExchange(exchange);
        if (instruments.length === 0) throw new Error('Empty exchange');
        return instruments;
    }

    @Query((returns) => [String])
    async exchangeList(): Promise<string[]> {
        return this.instrumentSvc.exchangeList();
    }
}
