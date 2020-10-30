import { newValidator } from './validator';
const ajv = newValidator();

export enum CandleInterval {
    MIN_01 = 'M01',
    MIN_05 = 'M05',
    MIN_10 = 'M10',
    MIN_15 = 'M15',
    MIN_30 = 'M30',
    MIN_60 = 'M60',
    DAY_01 = 'D01',
}

export const CandleDuration: Record<CandleInterval, number> = {
    [CandleInterval.MIN_01]: 60,
    [CandleInterval.MIN_05]: 60 * 5,
    [CandleInterval.MIN_10]: 60 * 10,
    [CandleInterval.MIN_15]: 60 * 15,
    [CandleInterval.MIN_30]: 60 * 30,
    [CandleInterval.MIN_60]: 60 * 60,
    [CandleInterval.DAY_01]: 60 * 60 * 24,
};

export interface IBrokerCandle {
    date: Date;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
}

export class Candle {
    key!: string;
    exchange!: string;
    instrumentId!: string;
    interval!: string;
    timeCode!: number;
    timestamp!: Date;
    open!: number;
    high!: number;
    low!: number;
    close!: number;
    volume!: number;
    openInterest!: number;
    totalVolume!: number;
    totalOpenInterest!: number;
}

const CandleSchema = {
    properties: {
        key: { type: 'string' },
        timestamp: { type: 'object' },
        open: { type: 'number' },
        high: { type: 'number' },
        low: { type: 'number' },
        close: { type: 'number' },
        volume: { type: 'number' },
        openInterest: { type: 'number' },
        totalVolume: { type: 'number' },
        totalOpenInterest: { type: 'number' },
        exchange: { type: 'string' },
        instrumentId: { type: 'string' },
        timeCode: { type: 'number' },
        interval: { type: 'string' },
    },
    required: [
        'key',
        'timestamp',
        'open',
        'high',
        'low',
        'close',
        'volume',
        'openInterest',
        'totalVolume',
        'totalOpenInterest',
        'exchange',
        'instrumentId',
        'timeCode',
        'interval',
    ],
    additionalProperties: false,
};

export const validateCandle = ajv.compile(CandleSchema);
