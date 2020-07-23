/* eslint-disable no-useless-constructor */
import axios from 'axios';
import { subHours } from 'date-fns';
import deepDiff from 'deep-diff';
import lodash from 'lodash';
import { from } from 'rxjs';
import { concatMap, mergeMap, toArray } from 'rxjs/operators';
import { Service } from 'typedi';
import { getRepository } from 'typeorm';

import { BrokerService } from '../broker';
import { LoggerService } from '../infra';
import { IInstrument } from '../types';
import { diffListOfObjects, mapFromObjectList } from '../util';
import { Instrument, InstrumentMeta } from './entity';

@Service()
export class InstrumentService {
    constructor(private loggerSvc: LoggerService, private brokerSvc: BrokerService) {}

    async insertInstrument(instrument: IInstrument): Promise<IInstrument> {
        await getRepository(Instrument).createQueryBuilder().insert().into(Instrument).values(instrument).execute();
        return instrument;
    }

    async getInstrumentsByExchange(exchange: string): Promise<Instrument[]> {
        return getRepository(Instrument)
            .createQueryBuilder('instrument')
            .where('instrument.exchange = :exchange', { exchange })
            .getMany();
    }

    async storeInstruments(exchange: string, inputInstruments: IInstrument[]): Promise<void> {
        const databaseInstruments: IInstrument[] = (await this.getInstrumentsByExchange(exchange)).map((item) => {
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const { id, live, track, rank, updatedAt, createdAt, ...rest } = item;
            return rest;
        });
        const diff = diffListOfObjects(databaseInstruments, inputInstruments, 'globalSymbol');
        this.loggerSvc.info(`Instrument stats for exchange: ${exchange}`, diff.stats);
        const removedSymbols = diff.removed.map((item) => item.globalSymbol);
        this.loggerSvc.info(`Disabling ... ${removedSymbols.length}`);
        if (removedSymbols.length > 0) {
            await getRepository(Instrument)
                .createQueryBuilder()
                .update()
                .set({ live: false })
                .where('globalSymbol IN (:globalSymbols)', { globalSymbols: removedSymbols })
                .execute();
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
                            return getRepository(Instrument)
                                .createQueryBuilder()
                                .update()
                                .set({ ...inputInstrumentMap[item.globalSymbol], live: true })
                                .where('globalSymbol = :globalSymbol', { globalSymbol: item.globalSymbol })
                                .execute();
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
            await getRepository(Instrument)
                .createQueryBuilder()
                .insert()
                .into('instrument')
                .values(diff.added)
                .execute();
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
                        await this.storeInstruments(exchange, instruments);
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
        const missingInstruments = await this.missingMetaInstruments(exchange);
        this.loggerSvc.info(`Missng instruments: ${missingInstruments.length}`);
        const outdatedInstruments = await this.outdatedMetaInstruments(exchange);
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

    async missingMetaInstruments(exchange: string): Promise<Instrument[]> {
        const nseInstruments = await this.allMetaInstruments(exchange);
        const nseGlobalSymbols = nseInstruments.map((instrument) => instrument.globalSymbol);
        const where =
            nseGlobalSymbols.length > 0
                ? 'globalSymbol NOT IN (:...globalSymbols) AND exchange = :exchange'
                : 'exchange = :exchange';
        return getRepository(Instrument)
            .createQueryBuilder()
            .where(where, {
                globalSymbols: nseGlobalSymbols,
                exchange,
            })
            .getMany();
    }

    async allMetaInstruments(exchange: string): Promise<InstrumentMeta[]> {
        return getRepository(InstrumentMeta).createQueryBuilder().where({ exchange }).getMany();
    }

    async outdatedMetaInstruments(exchange: string): Promise<InstrumentMeta[]> {
        const updatedAt = subHours(new Date(), 24);
        return getRepository(InstrumentMeta)
            .createQueryBuilder()
            .where('updatedAt < :updatedAt AND exchange = :exchange', { updatedAt, exchange })
            .getMany();
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
            const ffmc = lodash.get(response, 'data.marketDeptOrderBook.tradeInfo.ffmc', 0);
            const freeFloatPercent = totalMarketCap && ffmc ? (ffmc * 100) / totalMarketCap : 0;
            if ((await getRepository(InstrumentMeta).count({ globalSymbol: `${exchange}:${tradingSymbol}` })) === 0) {
                await getRepository(InstrumentMeta)
                    .createQueryBuilder()
                    .insert()
                    .values({
                        tradingSymbol,
                        freeFloatMarketCap: ffmc,
                        totalMarketCap,
                        freeFloatPercent,
                        globalSymbol: `${exchange}:${tradingSymbol}`,
                        exchange,
                    })
                    .execute();
            } else {
                await getRepository(InstrumentMeta)
                    .createQueryBuilder()
                    .update(InstrumentMeta)
                    .set({
                        freeFloatMarketCap: ffmc,
                        totalMarketCap,
                        freeFloatPercent,
                        globalSymbol: `${exchange}:${tradingSymbol}`,
                        exchange,
                    })
                    .where({ tradingSymbol })
                    .execute();
            }
        } catch (error) {
            this.loggerSvc.error(error);
        }
    }
}
