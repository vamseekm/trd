/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-var-requires */
import { get, Log, redisCachedGet } from '../infra';
import { PrefService } from '../pref';
import {
    BrokerQuoteLtp,
    IBrokerProfile,
    IInstrument,
    KITE_ACCESS_TOKEN,
    KITE_API_KEY,
    KITE_API_SECRET,
} from '../types';

const { KiteConnect, KiteTicker } = require('kiteconnect');

type KiteConnectType = typeof KiteConnect;
let kite: KiteConnectType | undefined;
async function kiteInstance(): Promise<KiteConnectType> {
    if (!kite) {
        const apiKey = await get(KITE_API_KEY);
        kite = new KiteConnect({ api_key: apiKey });
        const accessToken = await PrefService.get(KITE_ACCESS_TOKEN, '');
        if (!accessToken || accessToken.length === 0) {
            Log.error(`Access token not available: ${accessToken}`);
        }
        kite.setAccessToken(accessToken);
    }
    return kite;
}

async function getLoginUrl(): Promise<string> {
    return (await kiteInstance()).getLoginURL();
}

async function generateAccessToken(requestToken: string): Promise<string> {
    try {
        const instance = await kiteInstance();
        const { access_token } = await instance.generateSession(requestToken, get(KITE_API_SECRET));
        await PrefService.set(KITE_ACCESS_TOKEN, access_token);
        console.log('Access token:', access_token);
        return access_token;
    } catch (error) {
        return Promise.reject(error);
    }
}

async function getProfile(): Promise<IBrokerProfile> {
    return redisCachedGet({ key: 'Broker.getProfile', expiry: 8 * 3600 * 1000 }, async () => {
        const instance = await kiteInstance();
        const profile = await instance.getProfile();
        return {
            name: profile.user_shortname,
            exchanges: profile.exchanges,
            products: profile.products,
            orderTypes: profile.order_types,
        };
    });
}

async function getExchanges(): Promise<string[]> {
    const profile = await getProfile();
    return profile.exchanges.filter((exchange) => exchange !== 'BSE');
}

async function getLTP(globalSymbols: string[]): Promise<BrokerQuoteLtp[]> {
    const instance = await kiteInstance();
    const ltpObject = await instance.getLTP(globalSymbols);
    const keys = Object.keys(ltpObject);
    const response: BrokerQuoteLtp[] = [];
    keys.forEach((globalSymbol) => {
        response.push({
            globalSymbol,
            instrumentToken: ltpObject[globalSymbol].instrument_token,
            lastPrice: ltpObject[globalSymbol].last_price,
        });
    });
    return response;
}

async function getInstrumentsByExchange(exchange: string): Promise<IInstrument[]> {
    const instance = await kiteInstance();
    const instruments: any = await instance.getInstruments(exchange);
    return instruments
        .filter((item: any) => {
            if (!item.instrument_token || item.instrument_token.length === 0) {
                Log.json('Invalid instrument', item);
                return false;
            }
            return true;
        })
        .map(
            (ins: any): IInstrument => {
                const expiry = ins.expiry ? Math.floor(ins.expiry / 1000) : 0;
                const tradingSymbol = ins.tradingsymbol;
                return {
                    globalSymbol: `${ins.exchange}:${tradingSymbol}`,
                    instrumentToken: ins.instrument_token,
                    exchangeToken: ins.exchange_token,
                    tradingSymbol,
                    name: ins.name,
                    lastPrice: ins.last_price,
                    expiry,
                    strike: ins.strike,
                    tickSize: ins.tick_size,
                    lotSize: ins.lot_size,
                    instrumentType: ins.instrument_type,
                    segment: ins.segment,
                    exchange: ins.exchange,
                };
            },
        );
}

async function ticker(ids: string[], tick_handler: any, order_update_handler?: any): Promise<any> {
    const api_key = get(KITE_API_KEY);
    const access_token = await PrefService.get(KITE_ACCESS_TOKEN);

    return new Promise((resolve, reject) => {
        const ticker = new KiteTicker({
            api_key,
            access_token,
        });
        ticker.on('ticks', tick_handler);
        if (order_update_handler) {
            ticker.on('order_update', order_update_handler);
        }
        ticker.autoReconnect(true, -1, 5);
        ticker.on('disconnect', (error: any) => {
            Log.error('Kite: ticker disconnnected with error.', error);
        });
        ticker.on('error', (error: any) => {
            Log.error(error);
            reject(error);
        });
        ticker.on('connect', () => {
            Log.info('Kite: Connected...');
            Log.info(`Kite: Subscribing to ${ids.length} instruments with full quote mode...`);
            const numberIds = ids.map((id) => Number.parseInt(id));
            ticker.subscribe(numberIds);
            ticker.setMode(ticker.modeFull, numberIds);
            return resolve(ticker);
        });
        ticker.connect();
    });
}

export const BrokerService = {
    generateAccessToken,
    getExchanges,
    getInstrumentsByExchange,
    getProfile,
    getLTP,
    getLoginUrl,
    ticker,
};
