/* eslint-disable @typescript-eslint/no-var-requires */
/* eslint-disable camelcase */
/* eslint-disable no-useless-catch */
/* eslint-disable no-useless-constructor */
import { from } from 'rxjs';
import { filter, map, toArray } from 'rxjs/operators';

import { Config, LoggerService, Redis } from '../infra';
import { PrefService } from '../pref';
import {
    BrokerQuoteLtp,
    IBrokerProfile,
    IBrokerService,
    IInstrument,
    KITE_ACCESS_TOKEN,
    KITE_API_KEY,
    KITE_API_SECRET,
} from '../types';

const { KiteConnect } = require('kiteconnect');

type KiteConnectType = typeof KiteConnect;
export abstract class KiteService implements IBrokerService {
    private kite: KiteConnectType | undefined;

    config!: Config;

    logger!: LoggerService;

    redis!: Redis;

    prefSvc!: PrefService;

    async instance(): Promise<KiteConnectType> {
        if (!this.kite) {
            const apiKey = await this.config.get(KITE_API_KEY);
            this.kite = new KiteConnect({ api_key: apiKey });
            const accessToken = await this.prefSvc.configGet(KITE_ACCESS_TOKEN, '');
            if (!accessToken || accessToken.length === 0) {
                this.logger.error(`Access token not available: ${accessToken}`);
            }
            this.kite.setAccessToken(accessToken);
        }
        return this.kite;
    }

    async getLoginUrl(): Promise<string> {
        return (await this.instance()).getLoginURL();
    }

    async generateAccessToken(requestToken: string): Promise<string> {
        try {
            const instance = await this.instance();
            const { access_token } = await instance.generateSession(requestToken, this.config.get(KITE_API_SECRET));
            await this.prefSvc.configSet(KITE_ACCESS_TOKEN, access_token);
            console.log('Access token:', access_token);
            return access_token;
        } catch (error) {
            return Promise.reject(error);
        }
    }

    async getProfile(): Promise<IBrokerProfile> {
        return this.redis.cachedGet({ key: 'Broker.getProfile', expiry: 8 * 3600 * 1000 }, async () => {
            const kite = await this.instance();
            const profile = await kite.getProfile();
            return {
                name: profile.user_shortname,
                exchanges: profile.exchanges,
                products: profile.products,
                orderTypes: profile.order_types,
            };
        });
    }

    async getExchanges(): Promise<string[]> {
        const profile = await this.getProfile();
        return profile.exchanges.filter((exchange) => exchange !== 'BSE');
    }

    async getLTP(globalSymbols: string[]): Promise<BrokerQuoteLtp[]> {
        const kite = await this.instance();
        const ltpObject = await kite.getLTP(globalSymbols);
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

    async getInstrumentsByExchange(exchange: string): Promise<IInstrument[]> {
        const kite = await this.instance();
        const instruments: any = await kite.getInstruments(exchange);
        return from(instruments)
            .pipe(
                filter((item: any) => {
                    if (!item.instrument_token || item.instrument_token.length === 0) {
                        this.logger.json('Invalid instrument', item);
                        return false;
                    }
                    return true;
                }),
                map(
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
                ),
                toArray(),
            )
            .toPromise();
    }
}
