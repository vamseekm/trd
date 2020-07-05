/* eslint-disable @typescript-eslint/no-var-requires */
/* eslint-disable camelcase */
/* eslint-disable no-useless-catch */
/* eslint-disable no-useless-constructor */
import { Service } from 'typedi';
import { Config } from '../../infra/config';
import { DBService } from '../service';
import { KITE_API_KEY, KITE_ACCESS_TOKEN, KITE_API_SECRET, IBrokerProfile } from '../types';
import { Redis } from '../../infra';

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
                await this.config.get(KITE_API_SECRET),
            );
            await this.dbSerivce.configSet(KITE_ACCESS_TOKEN, access_token);
            return access_token;
        } catch (err) {
            throw err;
        }
    }

    async getProfile(): Promise<IBrokerProfile> {
        return this.redis.cachedGet({ key: 'Broker.getProfile', expiry: 8 * 3600 * 1000 }, async () => {
            const profile = await (await this.kiteInstance()).getProfile();
            return {
                name: profile.user_shortname,
                exchanges: profile.exchanges,
                products: profile.products,
                orderTypes: profile.order_types,
            };
        });
    }
}
