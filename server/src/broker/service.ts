/* eslint-disable @typescript-eslint/no-var-requires */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { transformAndValidate } from 'class-transformer-validator';
import { DateTime } from 'luxon';

import { CacheGroup } from '../database/repository/cache-group';
import { Config, Log } from '../infra';
import { PrefService } from '../pref';
import {
    BrokerQuoteLtp,
    CandleInterval,
    IBrokerCandle,
    IBrokerProfile,
    Instrument,
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

const brokerCache = new CacheGroup('broker');
async function getProfile(): Promise<IBrokerProfile> {
    return brokerCache.get({ key: 'Broker.getProfile', expiry: 8 * 3600 * 1000 }, async () => {
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

async function getLTP(inputIdList: string[]): Promise<BrokerQuoteLtp[]> {
    const kite = await kiteInstance();
    const ltpObject = await kite.getLTP(inputIdList);
    const instrumentIdList = Object.keys(ltpObject);
    return instrumentIdList.map(
        (id): BrokerQuoteLtp => {
            const { instrument_token: instrumentToken, last_price: lastPrice } = ltpObject[id];
            return { id, instrumentToken, lastPrice };
        },
    );
}
const brokerInstrumentCahce = new CacheGroup('bk_ins');
async function getInstrumentsByExchange(exchange: string): Promise<Instrument[]> {
    const instruments: any = await brokerInstrumentCahce.get({ key: exchange, expiry: 2 * 3600 * 1000 }, async () => {
        const kite = await kiteInstance();
        return kite.getInstruments(exchange);
    });
    const results: Instrument[] = [];
    for (const inputInstrument of instruments) {
        if (!inputInstrument.instrument_token || inputInstrument.instrument_token.length === 0) {
            Log.json('Invalid instrument', inputInstrument);
            continue;
        }
        const instrument = await transformAndValidate(Instrument, {
            id: `${exchange}${INSTRUMENT_ID_SEPERATOR}${inputInstrument.tradingsymbol}`,
            instrumentToken: inputInstrument.instrument_token,
            exchangeToken: inputInstrument.exchange_token,
            tradingSymbol: inputInstrument.tradingsymbol,
            name: inputInstrument.name,
            lastPrice: inputInstrument.last_price,
            expiry: inputInstrument.expiry ? new Date(inputInstrument.expiry) : new Date(0),
            strike: inputInstrument.strike,
            tickSize: inputInstrument.tick_size,
            lotSize: inputInstrument.lot_size,
            instrumentType: inputInstrument.instrument_type,
            segment: inputInstrument.segment,
            exchange: inputInstrument.exchange,
            live: true,
        });
        results.push(instrument);
    }
    return results;
}

async function ticker(instrumentTokenList: string[], tickHandler: any, orderUpdateHandler?: any): Promise<any> {
    const api_key = Config.get(KITE_API_KEY);
    const access_token = await PrefService.get(KITE_ACCESS_TOKEN);

    return new Promise((resolve, reject) => {
        const ticker = new KiteTicker({
            api_key,
            access_token,
        });
        ticker.on('ticks', tickHandler);
        if (orderUpdateHandler) {
            ticker.on('order_update', orderUpdateHandler);
        }
        ticker.autoReconnect(true, -1, 5);
        ticker.on('disconnect', (error: any) => {
            Log.error(error);
        });
        ticker.on('error', (error: any) => {
            Log.error(error);
            reject(error);
        });
        ticker.on('connect', () => {
            Log.info('Kite: Connected...');
            Log.info(`Kite: Subscribing to ${instrumentTokenList.length} instruments with full quote mode...`);
            const numberInstrumentTokenList = instrumentTokenList.map((instrumentToken) => {
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
    id,
    interval,
    from,
    to,
}: {
    id: string;
    interval: CandleInterval;
    from: Date;
    to: Date;
}): Promise<IBrokerCandle[]> {
    const kite = await kiteInstance();
    const kiteInterval = kiteIntervalMap[interval];
    const fromString = await kiteDateFormat(from);
    const toString = await kiteDateFormat(to);
    return kite.getHistoricalData(id, kiteInterval, fromString, toString);
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
