export interface IInstrument {
    id: string;
    instrumentToken: string;
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
