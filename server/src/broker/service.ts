/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-var-requires */
import { DateTime } from 'luxon';

import { Config, Log, Redis } from '../infra';
import { PrefService } from '../pref';
import {
    BrokerQuoteLtp,
    CandleInterval,
    IBrokerCandle,
    IBrokerProfile,
    IInstrument,
    INSTRUMENT_ID_SEPERATOR,
    KITE_ACCESS_TOKEN,
    KITE_API_KEY,
    KITE_API_SECRET,
} from '../types';

const { KiteConnect, KiteTicker } = require('kiteconnect');

type KiteConnectType = typeof KiteConnect;
let _kite: KiteConnectType | undefined;

async function kiteInstance(): Promise<KiteConnectType> {
    if (_kite != undefined) return _kite;
    const apiKey = await Config.get(KITE_API_KEY);
    _kite = new KiteConnect({ api_key: apiKey });
    const accessToken = await PrefService.get(KITE_ACCESS_TOKEN, '');
    console.log('Access token:', accessToken);
    if (!accessToken || accessToken.length === 0) Log.error(`Access token not available: ${accessToken}`);
    _kite.setAccessToken(accessToken);
    return _kite;
}

async function getLoginUrl(): Promise<string> {
    return (await kiteInstance()).getLoginURL();
}

async function generateAccessToken(requestToken: string): Promise<string> {
    try {
        const kite = await kiteInstance();
        const { access_token } = await kite.generateSession(requestToken, Config.get(KITE_API_SECRET));
        await PrefService.set(KITE_ACCESS_TOKEN, access_token);
        console.log('Access token:', access_token);
        return access_token;
    } catch (error) {
        return Promise.reject(error);
    }
}

async function getProfile(): Promise<IBrokerProfile> {
    return Redis.cacheGet({ key: 'Broker.getProfile', expiry: 8 * 3600 * 1000 }, async () => {
        const kite = await kiteInstance();
        const profile = await kite.getProfile();
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

async function getLTP(instrumentIdList: string[]): Promise<BrokerQuoteLtp[]> {
    const kite = await kiteInstance();
    const ltpObject = await kite.getLTP(instrumentIdList);
    const keys = Object.keys(ltpObject);
    const response: BrokerQuoteLtp[] = [];
    keys.forEach((id) => {
        response.push({
            id,
            instrumentToken: ltpObject[id].instrument_token,
            lastPrice: ltpObject[id].last_price,
        });
    });
    return response;
}

async function getInstrumentsByExchange(exchange: string): Promise<IInstrument[]> {
    const kite = await kiteInstance();
    const instruments: any = await kite.getInstruments(exchange);
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
                const tradingSymbol = ins.tradingsymbol;
                return {
                    id: `${ins.exchange}${INSTRUMENT_ID_SEPERATOR}${tradingSymbol}`,
                    instrumentToken: ins.instrument_token,
                    exchangeToken: ins.exchange_token,
                    tradingSymbol,
                    name: ins.name,
                    lastPrice: ins.last_price,
                    expiry: ins.expiry || new Date(0),
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

async function ticker(
    instrumentTokenList: (number | string)[],
    tick_handler: any,
    order_update_handler?: any,
): Promise<any> {
    const api_key = Config.get(KITE_API_KEY);
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
            Log.info(`Kite: Subscribing to ${instrumentTokenList.length} instruments with full quote mode...`);
            const numberInstrumentTokenList = instrumentTokenList.map((instrumentToken) => {
                if (typeof instrumentToken === 'number') return instrumentToken;
                return Number.parseInt(instrumentToken, 10);
            });
            console.log(numberInstrumentTokenList);
            ticker.subscribe(numberInstrumentTokenList);
            ticker.setMode(ticker.modeFull, numberInstrumentTokenList);
            return resolve(ticker);
        });
        ticker.connect();
    });
}

const kiteIntervalMap: Record<CandleInterval, string> = {
    [CandleInterval.MIN_01]: 'minute',
    [CandleInterval.MIN_05]: '5minute',
    [CandleInterval.MIN_10]: '10minute',
    [CandleInterval.MIN_15]: '15minute',
    [CandleInterval.MIN_30]: '30minute',
    [CandleInterval.MIN_60]: '60minute',
    [CandleInterval.DAY_01]: 'day',
};
async function kiteDateFormat(date: Date): Promise<string> {
    return DateTime.fromJSDate(date).setZone('UTC+05:30').toFormat('yyyy-MM-dd HH:mm:ss');
}
async function getHistorical({
    instrumentToken,
    interval,
    from,
    to,
}: {
    instrumentToken: number;
    interval: CandleInterval;
    from: Date;
    to: Date;
}): Promise<IBrokerCandle[]> {
    const kite = await kiteInstance();
    const kiteInterval = kiteIntervalMap[interval];
    const fromString = await kiteDateFormat(from);
    const toString = await kiteDateFormat(to);
    return kite.getHistoricalData(instrumentToken, kiteInterval, fromString, toString);
}

export const BrokerService = {
    generateAccessToken,
    getExchanges,
    getInstrumentsByExchange,
    getProfile,
    getLTP,
    getLoginUrl,
    ticker,
    getHistorical,
};
