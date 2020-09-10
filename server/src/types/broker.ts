import { IInstrument } from './instrument';

export interface IBrokerProfile {
    name: string;
    exchanges: string[];
    products: string[];
    orderTypes: string[];
}

export interface IBrokerService {
    getLoginUrl(): Promise<string>;
    generateAccessToken(requestToken: string): Promise<string>;
    getProfile(): Promise<IBrokerProfile>;
    getExchanges(): Promise<string[]>;
    getInstrumentsByExchange(exchange: string): Promise<IInstrument[]>;
}

export type BrokerQuoteLtp = Pick<IInstrument, 'id' | 'lastPrice' | 'instrumentToken'>;
