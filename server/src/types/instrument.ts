export interface IInstrument {
    id: string;
    instrumentToken: number;
    exchangeToken: string;
    tradingSymbol: string;
    name: string;
    lastPrice: number;
    expiry: Date;
    strike: number;
    tickSize: number;
    lotSize: number;
    instrumentType: string;
    segment: string;
    exchange: string;
}

export const INSTRUMENT_ID_SEPERATOR = '_';
