import axios, { AxiosInstance } from 'axios';
import lodash from 'lodash';
import LRUCache from 'lru-cache';

import { Log } from '../../infrastructure';
import { IMetaInfo, InstrumentConsts } from '../../types';

let _client: AxiosInstance | undefined;
function httpClient() {
    if (_client != undefined) return _client;
    const httpClient = axios.create();
    httpClient.defaults.timeout = 2000;
    return (_client = httpClient);
}
const nseCache = new LRUCache<string, string>({ maxAge: 10000 });
async function getNSECookie(): Promise<string> {
    const value = nseCache.get('cookie');
    if (value != undefined) return value;
    const response = await httpClient()('https://www.nseindia.com');
    const cookie = response.headers['set-cookie'];
    nseCache.set('cookie', cookie);
    return cookie;
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
        const response = await httpClient()(url, {
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
        const id = `${exchange}${InstrumentConsts.ID_SEPERATOR}${tradingSymbol}`;
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
}

export const InstrumentMetaService = {
    downloadSymbolMeta,
};
