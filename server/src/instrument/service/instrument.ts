import CliProgress from 'cli-progress';
import lodash from 'lodash';
import { Service } from 'typedi';

import { BrokerService } from '../../broker';
import { LoggerService } from '../../infra';
import { BrokerQuoteLtp, IInstrument } from '../../types';
import { diffListOfObjects, mapFromObjectList } from '../../util';
import { Instrument, InstrumentMeta } from '../entity';
import { InstrumentRepository } from '../repository/instrument';
import { InstrumentMetaRepository } from '../repository/instrument-meta';
import { InstrumentMetaService } from './instrument-meta';

@Service()
export class InstrumentService {
    constructor(
        private loggerSvc: LoggerService,
        private brokerSvc: BrokerService,
        private instrumentRepo: InstrumentRepository,
        private instrumentMetaRepo: InstrumentMetaRepository,
        private instrumentMetaSvc: InstrumentMetaService,
    ) {}

    async storeInstruments(exchange: string, inputInstruments: IInstrument[]): Promise<void> {
        const databaseInstruments: IInstrument[] = (
            await this.instrumentRepo.findInstrumentsBy({ search: { exchange } })
        ).map((item) => {
            // exclude props that shouldn't be considered for comparison.
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const { id, live, track, rank, updatedAt, createdAt, ...rest } = item;
            return { ...rest, lastPrice: 0 };
        });
        const diff = diffListOfObjects(databaseInstruments, inputInstruments, 'globalSymbol');
        this.loggerSvc.json(`Instrument stats for exchange: ${exchange}`, diff.stats);
        const removedSymbols = diff.removed.map((item) => item.globalSymbol);
        this.loggerSvc.info(`Disabling ... ${removedSymbols.length}`);
        if (removedSymbols.length > 0) {
            await this.instrumentRepo.markInstrumentsRemoved(removedSymbols);
        }
        const inputInstrumentMap = await mapFromObjectList(inputInstruments, 'globalSymbol');
        this.loggerSvc.info(`Updating ... ${diff.updated.length}`);
        if (diff.updated.length > 0) {
            const updates = diff.updated.map((instrument: IInstrument) => {
                return { ...inputInstrumentMap[instrument.globalSymbol], live: true };
            });
            this.instrumentRepo.updateInstruments(updates);
        }
        this.loggerSvc.info(`Inserting ... ${diff.added.length}`);
        if (diff.added.length > 0) {
            const inserts = diff.added.map(
                (instrument: IInstrument): Partial<Instrument> => {
                    return {
                        ...instrument,
                        live: true,
                    };
                },
            );
            await this.instrumentRepo.insertInstruments(inserts);
        }
        this.loggerSvc.info(`Done processing instruments.`);
    }

    async syncInstruments(): Promise<void> {
        const exchanges = (await this.brokerSvc.getExchanges()).filter((ex) => ex !== 'MF');
        this.loggerSvc.json({ exchanges });
        for (const exchange of exchanges) {
            try {
                this.loggerSvc.info(`Syncing exchange: ${exchange}`);
                const instruments = await this.brokerSvc.getInstrumentsByExchange(exchange);
                await this.storeInstruments(exchange, instruments);
            } catch (error) {
                this.loggerSvc.error(error);
            }
        }
    }

    async updateRanks(): Promise<void> {
        this.loggerSvc.info('Updating ranks...');
        const metaInstruments = (await this.instrumentMetaRepo.findMetaInstrumentsBy({ exchange: 'NSE' }))
            .filter((instrument) => instrument.freeFloatMarketCap)
            .sort((a, b) => b.freeFloatMarketCap - a.freeFloatMarketCap);
        const updates = metaInstruments.map((instrumentMeta: InstrumentMeta, index: number) => {
            const { globalSymbol } = instrumentMeta;
            return {
                globalSymbol,
                rank: index + 1,
            };
        });
        await this.instrumentRepo.updateInstruments(updates);
        this.loggerSvc.info('Done updating ranks.');
    }

    async fetchFuture(name: string, offset?: number): Promise<Instrument> {
        const instruments = await this.instrumentRepo.fetchFutures(name);
        offset = offset || 0;
        if (instruments.length <= offset) throw new Error(`Can't find future at ${offset} for "${name}"`);
        return instruments[offset];
    }

    async trackFnO(): Promise<void> {
        // Update all future LTP.
        const futures = await this.instrumentRepo.findInstrumentsBy({
            search: {
                exchange: 'NFO',
                segment: 'NFO-FUT',
            },
        });
        const globalSymbols = futures.map((future) => future.globalSymbol);
    }

    async trackInstruments(): Promise<void> {
        this.loggerSvc.info('Tracking instruments...');
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
        const topInstruments = await this.instrumentRepo.findTopInstruments({ exchange: 'NSE', limit: 200 });
        topInstruments.forEach((instrument: Instrument) => {
            globalSymbolsToTrack.push(instrument.globalSymbol);
        });
        await this.instrumentRepo.updateInstruments(
            globalSymbolsToTrack.map(
                (globalSymbol): Partial<Instrument> => {
                    return { globalSymbol, track: true };
                },
            ),
        );
        this.loggerSvc.info('Done tracking.');
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
            const ltpList: BrokerQuoteLtp[] = await this.brokerSvc.getLTP(chunk);
            await this.instrumentRepo.updateInstruments(ltpList);
            bar.increment(chunk.length);
        }
        bar.stop();
    }

    async updateLTPAll(): Promise<void> {
        this.loggerSvc.info('Update all LTP');
        const instruments = await this.instrumentRepo.findInstrumentsBy({ search: { live: true } });
        await this.updateLTP(instruments.map((instrument) => instrument.globalSymbol));
    }

    async syncMetaData(): Promise<void> {
        await this.instrumentMetaSvc.syncMetaData();
    }
}
