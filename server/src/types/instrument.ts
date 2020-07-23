/* eslint-disable camelcase */
export interface IInstrument {
    globalSymbol: string;
    instrumentToken: string;
    exchangeToken: string;
    tradingSymbol: string;
    name: string;
    lastPrice: number;
    expiry: number;
    strike: number;
    tickSize: number;
    lotSize: number;
    instrumentType: string;
    segment: string;
    exchange: string;
}
