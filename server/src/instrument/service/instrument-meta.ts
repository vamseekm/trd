import axios from 'axios';
import lodash from 'lodash';

import { CacheGroup } from '../../database/repository/cache-group';
import { Log } from '../../infra';
import { IMetaInfo, INSTRUMENT_ID_SEPERATOR } from '../../types';

const nseCache = new CacheGroup('nseindia.com');
async function getNSECookie(): Promise<string> {
    return nseCache.get({ key: 'cookie', expiry: 10 * 1000 }, async () => {
        const response = await axios('https://www.nseindia.com');
        return response.headers['set-cookie'];
    });
}

async function downloadSymbolMeta({
    exchange,
    tradingSymbol,
}: {
    tradingSymbol: string;
    exchange: string;
}): Promise<IMetaInfo | undefined> {
    await getNSECookie();
    try {
        const url = `https://www.nseindia.com/api/quote-equity?symbol=${tradingSymbol}&section=trade_info`;
        const response = await axios(url, {
            headers: {
                Cookie: await getNSECookie(),
                // Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                // 'Accept-Encoding': 'gzip, deflate, br',
                // 'Accept-Language': 'en-US,en;q=0.5',
                // 'Cache-Control': 'max-age=0',
                // 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.16; rv:81.0) Gecko/20100101 Firefox/81.0',
            },
        });
        if (response.status !== 200) {
            throw new Error(response.statusText);
        }
        const totalMarketCap = lodash.get(response, 'data.marketDeptOrderBook.tradeInfo.totalMarketCap', 0) || 0;
        const freeFloatMarketCap = lodash.get(response, 'data.marketDeptOrderBook.tradeInfo.ffmc', 0) || 0;
        const freeFloatPercent = totalMarketCap && freeFloatMarketCap ? (freeFloatMarketCap * 100) / totalMarketCap : 0;
        const id = `${exchange}${INSTRUMENT_ID_SEPERATOR}${tradingSymbol}`;
        return {
            id,
            freeFloatMarketCap,
            totalMarketCap,
            freeFloatPercent,
            metaLastUpdated: new Date(),
        };
    } catch (error) {
        Log.error(error);
    }
    return undefined;
}

export const InstrumentMetaService = {
    downloadSymbolMeta,
};
