/* eslint-disable @typescript-eslint/no-var-requires */
/* eslint-disable camelcase */
/* eslint-disable no-useless-catch */
/* eslint-disable no-useless-constructor */
import { Service } from 'typedi';
import { from } from 'rxjs';
import { map, filter, toArray } from 'rxjs/operators';

import { Config } from '../../infra/config';
import { DBService } from '../service';
import { KITE_API_KEY, KITE_ACCESS_TOKEN, KITE_API_SECRET, IBrokerProfile } from '../types';
import { Redis } from '../../infra';
import { IInstrument } from '../types/instrument';

const { KiteConnect } = require('kiteconnect');

type KiteConnectType = typeof KiteConnect;

@Service()
export class BrokerAPI {
    private kite: KiteConnectType | undefined;

    constructor(private config: Config, private dbSerivce: DBService, private redis: Redis) {}

    async kiteInstance(): Promise<KiteConnectType> {
        if (!this.kite) {
            const apiKey = await this.config.get(KITE_API_KEY);
            this.kite = new KiteConnect({ api_key: apiKey });
            const accessToken = await this.dbSerivce.configGet(KITE_ACCESS_TOKEN, '');
            if (!accessToken || accessToken.length === 0) {
                console.warn(`Access token not available: ${accessToken}`);
            }
            this.kite.setAccessToken(accessToken);
        }
        return this.kite;
    }

    async getLoginUrl(): Promise<string> {
        return (await this.kiteInstance()).getLoginURL();
    }

    async generateAccessToken(requestToken: string): Promise<string> {
        try {
            const { access_token } = await (await this.kiteInstance()).generateSession(
                requestToken,
                this.config.get(KITE_API_SECRET),
            );
            await this.dbSerivce.configSet(KITE_ACCESS_TOKEN, access_token);
            return access_token;
        } catch (err) {
            throw err;
        }
    }

    async getProfile(): Promise<IBrokerProfile> {
        return this.redis.cachedGet({ key: 'Broker.getProfile', expiry: 8 * 3600 * 1000 }, async () => {
            const kite = await this.kiteInstance();
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
        return profile.exchanges;
    }

    async getInstrumentsByExchange(exchange: string): Promise<IInstrument[]> {
        const kite = await this.kiteInstance();
        const instruments: any = await kite.getInstruments(exchange);
        return from(instruments)
            .pipe(
                filter((item: any) => {
                    if (!item.instrument_token || item.instrument_token.length === 0) {
                        console.log(`Found invalid instrument in ${exchange}:`, JSON.stringify(item, null, 4));
                        return false;
                    }
                    return true;
                }),
                map(
                    (ins: any): IInstrument => {
                        const expiry = ins.expiry && ins.expiry.length > 0 ? Number.parseInt(ins.expiry, 10) : 0;
                        return {
                            instrumentToken: ins.instrument_token,
                            exchangeToken: ins.exchange_token,
                            tradingSymbol: ins.tradingsymbol,
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
