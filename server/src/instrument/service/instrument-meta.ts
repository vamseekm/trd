import axios from 'axios';
import lodash from 'lodash';
import plimit from 'p-limit';

import { Log } from '../../infra';
import { InstrumentMetaRepository } from '../repository/instrument-meta';

async function updateSymbolMeta({
    exchange,
    tradingSymbol,
}: {
    tradingSymbol: string;
    exchange: string;
}): Promise<void> {
    try {
        const url = `https://www.nseindia.com/api/quote-equity?symbol=${tradingSymbol}&section=trade_info`;
        Log.info(`Fetching meta for ${exchange}:${tradingSymbol} ...`);
        const response = await axios(url);
        if (response.status !== 200) {
            throw new Error(response.statusText);
        }
        const totalMarketCap = lodash.get(response, 'data.marketDeptOrderBook.tradeInfo.totalMarketCap', 0);
        const freeFloatMarketCap = lodash.get(response, 'data.marketDeptOrderBook.tradeInfo.ffmc', 0);
        const freeFloatPercent = totalMarketCap && freeFloatMarketCap ? (freeFloatMarketCap * 100) / totalMarketCap : 0;
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
        Log.error(error);
    }
}

async function syncMetaData(): Promise<void> {
    const exchange = 'NSE';
    Log.info('Syncing NSE meta data ...');
    const missingInstruments = await InstrumentMetaRepository.findMetaInstrumentsNotPresent(exchange);
    Log.info(`Missng instruments: ${missingInstruments.length}`);
    const outdatedInstruments = await InstrumentMetaRepository.findMetaInstrumentsOutdated(exchange);
    Log.info(`Outdated instruments: ${outdatedInstruments.length}`);
    const limit = plimit(4);
    const allInstruments = [...missingInstruments, ...outdatedInstruments];
    await Promise.all(
        allInstruments.map((instrument) => {
            return limit(() => updateSymbolMeta({ exchange, tradingSymbol: instrument.tradingSymbol }));
        }),
    );
    Log.info('Done syncing NSE meta.');
}

export const InstrumentMetaService = {
    updateSymbolMeta,
    syncMetaData,
};
