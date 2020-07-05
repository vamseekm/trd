/* eslint-disable @typescript-eslint/no-var-requires */
/* eslint-disable camelcase */
/* eslint-disable no-useless-catch */
/* eslint-disable no-useless-constructor */
import { Service } from 'typedi';
import { Config, KITE_API_KEY, KITE_API_SECRET, KITE_ACCESS_TOKEN } from '../infra/config';

const { KiteConnect } = require('kiteconnect');

type KiteConnectType = typeof KiteConnect;

@Service()
export class BrokerService {
    private kite: KiteConnectType | undefined;

    constructor(private config: Config) {}

    async kiteInstance(): Promise<KiteConnectType> {
        if (!this.kite) {
            const apiKey = await this.config.get(KITE_API_KEY);
            console.log(apiKey);
            this.kite = new KiteConnect({ api_key: apiKey });
            console.log('Setting access token:', await this.config.get(KITE_ACCESS_TOKEN));
            this.kite.setAccessToken(await this.config.get(KITE_ACCESS_TOKEN));
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
            await this.config.set(KITE_ACCESS_TOKEN, access_token);
            return access_token;
        } catch (err) {
            throw err;
        }
    }
}
