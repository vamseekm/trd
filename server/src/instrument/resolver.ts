/* eslint-disable @typescript-eslint/no-unused-vars */
import { Arg, Query, Resolver } from 'type-graphql';

import { Instrument } from './entity';
import { InstrumentRepository } from './repository/instrument';

@Resolver()
export class InstrumentResolver {
    @Query((returns) => [Instrument])
    async searchInstruments(): Promise<Instrument[]> {
        return [];
    }

    @Query((returns) => Instrument)
    async instrumentByGlobalSymbol(@Arg('symbol') globalSymbol: string): Promise<Instrument> {
        const instruments = await InstrumentRepository.findInstrumentsBy({ search: { globalSymbol } });
        if (!instruments) {
            throw new Error('Instrument not found');
        }
        return instruments[0];
    }

    @Query((returns) => [Instrument])
    async instrumentsByExchange(@Arg('exchange') exchange: string): Promise<Instrument[]> {
        const instruments = await InstrumentRepository.findInstrumentsBy({ search: { exchange } });
        if (instruments.length === 0) throw new Error('Empty exchange');
        return instruments;
    }

    @Query((returns) => [String])
    async exchangeList(): Promise<string[]> {
        return InstrumentRepository.exchangeList();
    }
}
