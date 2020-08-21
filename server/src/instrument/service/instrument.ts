import CliProgress from 'cli-progress';
import lodash from 'lodash';
import { Service } from 'typedi';

import { BrokerService } from '../../broker';
import { logError, logInfo, logJson } from '../../infra';
import { BrokerQuoteLtp, IInstrument } from '../../types';
import { diffListOfObjects, mapFromObjectList } from '../../util';
import { Instrument, InstrumentMeta } from '../entity';
import { InstrumentRepository } from '../repository/instrument';
import { InstrumentMetaRepository } from '../repository/instrument-meta';
import { InstrumentMetaService } from './instrument-meta';

@Service()
export class InstrumentService {
    constructor(private instrumentMetaSvc: InstrumentMetaService) {}

    async storeInstruments(exchange: string, inputInstruments: IInstrument[]): Promise<void> {
        const databaseInstruments: IInstrument[] = (
            await InstrumentRepository.findInstrumentsBy({ search: { exchange } })
        ).map((item) => {
            // exclude props that shouldn't be considered for comparison.
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const { id, live, track, rank, updatedAt, createdAt, ...rest } = item;
            return { ...rest, lastPrice: 0 };
        });
        const diff = diffListOfObjects(databaseInstruments, inputInstruments, 'globalSymbol');
        logJson(`Instrument stats for exchange: ${exchange}`, diff.stats);
        const removedSymbols = diff.removed.map((item) => item.globalSymbol);
        logInfo(`Disabling ... ${removedSymbols.length}`);
        if (removedSymbols.length > 0) {
            await InstrumentRepository.markInstrumentsRemoved(removedSymbols);
        }
        const inputInstrumentMap = await mapFromObjectList(inputInstruments, 'globalSymbol');
        logInfo(`Updating ... ${diff.updated.length}`);
        if (diff.updated.length > 0) {
            const updateList: Partial<Instrument>[] = [];
            for (const instrument of diff.updated) {
                updateList.push({ ...inputInstrumentMap[instrument.globalSymbol], live: true });
            }
            InstrumentRepository.updateInstruments(updateList);
        }
        logInfo(`Inserting ... ${diff.added.length}`);
        if (diff.added.length > 0) {
            const insertList: Partial<Instrument>[] = [];
            for (const instrument of diff.added) {
                insertList.push({ ...instrument, live: true });
            }
            await InstrumentRepository.insertInstruments(insertList);
        }
        logInfo(`Done processing instruments.`);
    }

    async syncInstruments(): Promise<void> {
        const exchanges = (await BrokerService.getExchanges()).filter((ex) => ex !== 'MF');
        logJson('Exchange list:', { exchanges });
        for (const exchange of exchanges) {
            try {
                logInfo(`Syncing exchange: ${exchange}`);
                const instruments = await BrokerService.getInstrumentsByExchange(exchange);
                await this.storeInstruments(exchange, instruments);
            } catch (error) {
                logError(error);
            }
        }
    }

    async updateRanks(): Promise<void> {
        logInfo('Updating ranks...');
        const metaInstruments = (await InstrumentMetaRepository.findMetaInstrumentsBy({ exchange: 'NSE' }))
            .filter((instrument) => instrument.freeFloatMarketCap)
            .sort((a, b) => b.freeFloatMarketCap - a.freeFloatMarketCap);
        const updateList = metaInstruments.map((instrumentMeta: InstrumentMeta, index: number) => {
            const { globalSymbol } = instrumentMeta;
            return { globalSymbol, rank: index + 1 };
        });
        await InstrumentRepository.updateInstruments(updateList);
        logInfo('Done updating ranks.');
    }

    async fetchFuture(name: string, offset?: number): Promise<Instrument> {
        const instruments = await InstrumentRepository.fetchFutures(name);
        offset = offset || 0;
        if (instruments.length <= offset) throw new Error(`Can't find future at ${offset} for "${name}"`);
        return instruments[offset];
    }

    async trackFnO(): Promise<void> {
        // Update all future LTP.
        const futures = await InstrumentRepository.findInstrumentsBy({
            search: {
                exchange: 'NFO',
                segment: 'NFO-FUT',
            },
        });
        const globalSymbols = futures.map((future) => future.globalSymbol);
    }

    async trackInstruments(): Promise<void> {
        logInfo('Tracking instruments...');
        const globalSymbolsToTrack: string[] = [
            'NSE:INDIA VIX',
            'NSE:NIFTY 50',
            'NSE:NIFTY 500',
            'NSE:NIFTY BANK',
            'NSE:NIFTY AUTO',
            'NSE:NIFTY COMMODITIES',
            'NSE:NIFTY CONSUMPTION',
            'NSE:NIFTY ENERGY',
            'NSE:NIFTY FMCG',
            'NSE:NIFTY INFRA',
            'NSE:NIFTY IT',
            'NSE:NIFTY MEDIA',
            'NSE:NIFTY METAL',
            'NSE:NIFTY MNC',
            'NSE:NIFTY PHARMA',
            'NSE:NIFTY PSE',
            'NSE:NIFTY REALTY',
            'NSE:NIFTYBEES',
            'NSE:BANKBEES',
            'NSE:GOLDBEES',
        ];
        const topInstruments = await InstrumentRepository.findTopInstruments({ exchange: 'NSE', limit: 500 });
        topInstruments.forEach((instrument: Instrument) => {
            globalSymbolsToTrack.push(instrument.globalSymbol);
        });
        await InstrumentRepository.updateInstruments(
            globalSymbolsToTrack.map(
                (globalSymbol): Partial<Instrument> => {
                    return { globalSymbol, track: true };
                },
            ),
        );
        logInfo('Done tracking.');
    }

    async updateLTP(globalSymbols: string[]): Promise<void> {
        const totalInstruments = globalSymbols.length;
        const chunks = lodash.chunk(globalSymbols, 100);
        const bar = new CliProgress.SingleBar(
            { noTTYOutput: true, notTTYSchedule: 5000 },
            CliProgress.Presets.shades_classic,
        );
        bar.start(totalInstruments, 0);
        for (const chunk of chunks) {
            const ltpList: BrokerQuoteLtp[] = await BrokerService.getLTP(chunk);
            await InstrumentRepository.updateInstruments(ltpList);
            bar.increment(chunk.length);
        }
        bar.stop();
    }

    async updateLTPAll(): Promise<void> {
        logInfo('Update all LTP');
        const instruments = await InstrumentRepository.findInstrumentsBy({ search: { live: true } });
        await this.updateLTP(instruments.map((instrument) => instrument.globalSymbol));
    }

    async syncMetaData(): Promise<void> {
        await this.instrumentMetaSvc.syncMetaData();
    }

    async getTrackedInstruments(): Promise<Instrument[]> {
        return InstrumentRepository.findInstrumentsBy({ search: { track: true } });
    }

    async fetchInstrumentByToken(instrumentToken: string): Promise<Instrument | undefined> {
        const instruments = await InstrumentRepository.findInstrumentsBy({ search: { instrumentToken } });
        if (instruments != undefined && instruments.length > 0) {
            return instruments[0];
        }
    }
}
