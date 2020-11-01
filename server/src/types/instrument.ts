import { newValidator } from './validator';
export interface IMetaInfo {
    id: string;
    freeFloatMarketCap?: number;
    totalMarketCap?: number;
    freeFloatPercent?: number;
    metaLastUpdated?: Date;
    rank?: number;
}

export interface Instrument extends IMetaInfo {
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

    live?: boolean;
    track?: boolean;

    historicalLastSynced?: Date;
}

const InstrumentSchema = {
    properties: {
        id: { type: 'string' },
        instrumentToken: { type: 'string' },
        exchangeToken: { type: 'string' },
        tradingSymbol: { type: 'string' },
        name: { type: 'string' },
        lastPrice: { type: 'number' },
        expiry: { instanceof: 'Date' },
        strike: { type: 'number' },
        tickSize: { type: 'number' },
        lotSize: { type: 'number' },
        instrumentType: { type: 'string' },
        segment: { type: 'string' },
        exchange: { type: 'string' },
        live: { type: 'boolean' },
        track: { type: 'boolean' },
        freeFloatMarketCap: { type: 'number' },
        totalMarketCap: { type: 'number' },
        freeFloatPercent: { type: 'number' },
        metaLastUpdated: { instanceof: 'Date' },
        rank: { type: 'number' },
    },
    required: [
        'id',
        'instrumentToken',
        'exchangeToken',
        'tradingSymbol',
        'name',
        'lastPrice',
        'expiry',
        'strike',
        'tickSize',
        'lotSize',
        'instrumentType',
        'segment',
        'exchange',
    ],
};

export const validateInstrument = newValidator().compile(InstrumentSchema);
export const InstrumentConsts = {
    ID_SEPERATOR: ':',
};
