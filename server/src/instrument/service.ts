import axios from 'axios';
import deepDiff from 'deep-diff';
import lodash from 'lodash';
import { from } from 'rxjs';
import { concatMap, mergeMap, toArray } from 'rxjs/operators';
import { Service } from 'typedi';

import { BrokerService } from '../broker';
import { LoggerService } from '../infra';
import { IInstrument } from '../types';
import { diffListOfObjects, mapFromObjectList } from '../util';
import { Instrument } from './entity';
import { InstrumentRepository } from './repository';

@Service()
export class InstrumentService {
    constructor(
        private loggerSvc: LoggerService,
        private brokerSvc: BrokerService,
        private instrumentRepo: InstrumentRepository,
    ) {}

    async storeInstruments(exchange: string, inputInstruments: IInstrument[]): Promise<void> {
        const databaseInstruments: IInstrument[] = (await this.instrumentRepo.findInstrumentsBy({ exchange })).map(
            (item) => {
                // exclude props that shouldn't be considered for comparison.
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                const { id, live, track, rank, updatedAt, createdAt, ...rest } = item;
                return rest;
            },
        );
        const diff = diffListOfObjects(databaseInstruments, inputInstruments, 'globalSymbol');
        this.loggerSvc.info(`Instrument stats for exchange: ${exchange}`, diff.stats);
        const removedSymbols = diff.removed.map((item) => item.globalSymbol);
        this.loggerSvc.info(`Disabling ... ${removedSymbols.length}`);
        if (removedSymbols.length > 0) {
            await this.instrumentRepo.markInstrumentsRemoved(removedSymbols);
        }
        const inputInstrumentMap = await mapFromObjectList(inputInstruments, 'globalSymbol');
        const databaseInstrumentMap = await mapFromObjectList(databaseInstruments, 'globalSymbol');
        this.loggerSvc.info(`Updating ... ${diff.updated.length}`);
        if (diff.updated.length > 0) {
            try {
                await from(diff.updated)
                    .pipe(
                        mergeMap(async (item) => {
                            this.loggerSvc.json({
                                message: `Diff between downloaded instrument & dbInstrument for exchange: ${exchange}`,
                                diff: deepDiff.diff(
                                    databaseInstrumentMap[item.globalSymbol],
                                    inputInstrumentMap[item.globalSymbol],
                                ),
                            });
                            return this.instrumentRepo.updateInstrument(
                                item.globalSymbol,
                                inputInstrumentMap[item.globalSymbol],
                            );
                        }, 4),
                        toArray(),
                    )
                    .toPromise();
            } catch (error) {
                this.loggerSvc.error(error);
            }
        }
        this.loggerSvc.info(`Inserting ... ${diff.added.length}`);
        if (diff.added.length > 0) {
            return this.instrumentRepo.insertInstrumentsBulk(diff.added as Instrument[]);
        }
    }

    async syncInstruments(): Promise<void> {
        const exchanges = (await this.brokerSvc.getExchanges()).filter((ex) => ex !== 'MF');
        this.loggerSvc.json({ exchanges });
        await from(exchanges)
            .pipe(
                concatMap(async (exchange) => {
                    try {
                        this.loggerSvc.info(`Syncing exchange: ${exchange}`);
                        const instruments = await this.brokerSvc.getInstrumentsByExchange(exchange);
                        return this.storeInstruments(exchange, instruments);
                    } catch (error) {
                        this.loggerSvc.error(error);
                    }
                }),
                toArray(),
            )
            .toPromise();
    }

    async syncMetaData(): Promise<void> {
        const exchange = 'NSE';
        this.loggerSvc.info('Syncing NSE meta data ...');
        const missingInstruments = await this.instrumentRepo.findMetaInstrumentsNotPresent(exchange);
        this.loggerSvc.info(`Missng instruments: ${missingInstruments.length}`);
        const outdatedInstruments = await this.instrumentRepo.findMetaInstrumentsOutdated(exchange);
        this.loggerSvc.info(`Outdated instruments: ${outdatedInstruments.length}`);

        await from(missingInstruments)
            .pipe(
                mergeMap(
                    (instrument) => this.updateSymbolMeta({ exchange, tradingSymbol: instrument.tradingSymbol }),
                    2,
                ),
                toArray(),
            )
            .toPromise();

        await from(outdatedInstruments)
            .pipe(
                mergeMap(
                    (instrument) => this.updateSymbolMeta({ exchange, tradingSymbol: instrument.tradingSymbol }),
                    2,
                ),
                toArray(),
            )
            .toPromise();
        this.loggerSvc.info('Done syncing NSE meta.');
    }

    async updateSymbolMeta({ exchange, tradingSymbol }: { tradingSymbol: string; exchange: string }): Promise<void> {
        try {
            const url = `https://www.nseindia.com/api/quote-equity?symbol=${tradingSymbol}&section=trade_info`;
            this.loggerSvc.info(`Fetching meta for ${exchange}:${tradingSymbol} ...`);
            const response = await axios(url);
            if (response.status !== 200) {
                throw new Error(response.statusText);
            }
            const totalMarketCap = lodash.get(response, 'data.marketDeptOrderBook.tradeInfo.totalMarketCap', 0);
            const freeFloatMarketCap = lodash.get(response, 'data.marketDeptOrderBook.tradeInfo.ffmc', 0);
            const freeFloatPercent =
                totalMarketCap && freeFloatMarketCap ? (freeFloatMarketCap * 100) / totalMarketCap : 0;
            const globalSymbol = `${exchange}:${tradingSymbol}`;
            return this.instrumentRepo.upsertMetaInstrument(globalSymbol, {
                tradingSymbol,
                freeFloatMarketCap,
                totalMarketCap,
                freeFloatPercent,
                globalSymbol,
                exchange,
            });
        } catch (error) {
            this.loggerSvc.error(error);
        }
    }

    async updateRanks(): Promise<void> {
        this.loggerSvc.info('Updating ranks...');
        const metaInstruments = (await this.instrumentRepo.findMetaInstrumentsBy({ exchange: 'NSE' }))
            .filter((instrument) => instrument.freeFloatMarketCap)
            .sort((a, b) => b.freeFloatMarketCap - a.freeFloatMarketCap);
        await from(metaInstruments)
            .pipe(
                mergeMap(async (instrument, index) => {
                    const { globalSymbol } = instrument;
                    return this.instrumentRepo.updateInstrument(globalSymbol, { rank: index + 1 });
                }),
                toArray(),
            )
            .toPromise();
        console.log('Done updating ranks.');
    }

    async trackInstruments(): Promise<void> {
        console.log('Track instruments...');
    }
}
