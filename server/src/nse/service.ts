import axios from 'axios';
import { setSeconds, subHours } from 'date-fns';
import lodash from 'lodash';
import { format } from 'path';
import { exit } from 'process';
import { from } from 'rxjs';
import { concatMap, mergeMap, toArray } from 'rxjs/operators';
import { Service } from 'typedi';
import { getRepository } from 'typeorm';

import { LoggerService } from '../infra';
import { Instrument, InstrumentService } from '../instrument';
import { NSEInstrument } from './entity';

@Service()
export class NSEService {
    constructor(private instrumentSvc: InstrumentService, private loggerSvc: LoggerService) { }

    async syncMetaData(): Promise<void> {
        this.loggerSvc.info('Syncing NSE meta data ...');

        const missingInstruments = await this.missingInstruments();
        this.loggerSvc.info(`Missng instruments: ${missingInstruments.length}`);
        const outdatedInstruments = await this.outdatedInstruments();
        this.loggerSvc.info(`Outdated instruments: ${outdatedInstruments.length}`);

        await from(missingInstruments)
            .pipe(
                mergeMap((instrument) => this.fetchMetaForSymbol(instrument.tradingSymbol), 2),
                toArray(),
            )
            .toPromise();

        await from(outdatedInstruments)
            .pipe(
                mergeMap((instrument) => this.fetchMetaForSymbol(instrument.tradingSymbol), 2),
                toArray(),
            )
            .toPromise();
        this.loggerSvc.info('Done syncing NSE meta.');
    }

    async missingInstruments(): Promise<Instrument[]> {
        const nseInstruments = await this.allInstruments();
        const nseGlobalSymbols = nseInstruments.map((instrument) => instrument.globalSymbol);
        const where =
            nseGlobalSymbols.length > 0
                ? 'globalSymbol NOT IN (:...globalSymbols) AND exchange = :exchange'
                : 'exchange = :exchange';
        return getRepository(Instrument)
            .createQueryBuilder()
            .where(where, {
                globalSymbols: nseGlobalSymbols,
                exchange: 'NSE',
            })
            .getMany();
    }

    async allInstruments() {
        return getRepository(NSEInstrument).createQueryBuilder().getMany();
    }

    async outdatedInstruments(): Promise<NSEInstrument[]> {
        const updatedAt = subHours(new Date(), 24);
        return getRepository(NSEInstrument)
            .createQueryBuilder()
            .where('updatedAt < :updatedAt', { updatedAt })
            .getMany();
    }

    async fetchMetaForSymbol(tradingSymbol: string): Promise<void> {
        try {
            const url = `https://www.nseindia.com/api/quote-equity?symbol=${tradingSymbol}&section=trade_info`;
            this.loggerSvc.info(`Fetching meta for NSE:${tradingSymbol} ...`);
            const response = await axios(url);
            if (response.status !== 200) {
                throw new Error(response.statusText);
            }
            const totalMarketCap = lodash.get(response, 'data.marketDeptOrderBook.tradeInfo.totalMarketCap', 0);
            const ffmc = lodash.get(response, 'data.marketDeptOrderBook.tradeInfo.ffmc', 0);
            const freeFloatPercent = totalMarketCap && ffmc ? (ffmc * 100) / totalMarketCap : 0;
            if ((await getRepository(NSEInstrument).count({ tradingSymbol })) === 0) {
                await getRepository(NSEInstrument)
                    .createQueryBuilder()
                    .insert()
                    .values({
                        tradingSymbol,
                        freeFloatMarketCap: ffmc,
                        totalMarketCap,
                        freeFloatPercent,
                        globalSymbol: `NSE:${tradingSymbol}`,
                    })
                    .execute();
            } else {
                await getRepository(NSEInstrument)
                    .createQueryBuilder()
                    .update(NSEInstrument)
                    .set({
                        freeFloatMarketCap: ffmc,
                        totalMarketCap,
                        freeFloatPercent,
                        globalSymbol: `NSE:${tradingSymbol}`,
                    })
                    .where({ tradingSymbol })
                    .execute();
            }
        } catch (error) {
            this.loggerSvc.error(error);
        }
    }
}
