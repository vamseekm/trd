import axios from 'axios';
import lodash from 'lodash';
import plimit from 'p-limit';
import { Service } from 'typedi';

import { logError, logInfo } from '../../infra';
import { InstrumentMetaRepository } from '../repository/instrument-meta';

@Service()
export class InstrumentMetaService {
    async updateSymbolMeta({ exchange, tradingSymbol }: { tradingSymbol: string; exchange: string }): Promise<void> {
        try {
            const url = `https://www.nseindia.com/api/quote-equity?symbol=${tradingSymbol}&section=trade_info`;
            logInfo(`Fetching meta for ${exchange}:${tradingSymbol} ...`);
            const response = await axios(url);
            if (response.status !== 200) {
                throw new Error(response.statusText);
            }
            const totalMarketCap = lodash.get(response, 'data.marketDeptOrderBook.tradeInfo.totalMarketCap', 0);
            const freeFloatMarketCap = lodash.get(response, 'data.marketDeptOrderBook.tradeInfo.ffmc', 0);
            const freeFloatPercent =
                totalMarketCap && freeFloatMarketCap ? (freeFloatMarketCap * 100) / totalMarketCap : 0;
            const globalSymbol = `${exchange}:${tradingSymbol}`;
            return InstrumentMetaRepository.upsertMetaInstrument(globalSymbol, {
                tradingSymbol,
                freeFloatMarketCap,
                totalMarketCap,
                freeFloatPercent,
                globalSymbol,
                exchange,
            });
        } catch (error) {
            logError(error);
        }
    }
    async syncMetaData(): Promise<void> {
        const exchange = 'NSE';
        logInfo('Syncing NSE meta data ...');
        const missingInstruments = await InstrumentMetaRepository.findMetaInstrumentsNotPresent(exchange);
        logInfo(`Missng instruments: ${missingInstruments.length}`);
        const outdatedInstruments = await InstrumentMetaRepository.findMetaInstrumentsOutdated(exchange);
        logInfo(`Outdated instruments: ${outdatedInstruments.length}`);
        const limit = plimit(4);
        const allInstruments = [...missingInstruments, ...outdatedInstruments];
        await Promise.all(
            allInstruments.map((instrument) => {
                return limit(() => this.updateSymbolMeta({ exchange, tradingSymbol: instrument.tradingSymbol }));
            }),
        );
        logInfo('Done syncing NSE meta.');
    }
}
