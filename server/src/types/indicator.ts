import { newValidator } from './validator';
const ajv = newValidator();
export class Indicator {
    key!: string;
    instrumentId!: string;
    interval!: string;
    timestamp!: Date;
    open!: number;
    high!: number;
    low!: number;
    close!: number;
    volume!: number;
    openInterest!: number;
}

const IndicatorSchema = {
    properties: {
        key: { type: 'string' },
        instrumentId: { type: 'string' },
        interval: { type: 'string' },
        timestamp: { type: 'object' },

        open: { type: 'number' },
        high: { type: 'number' },
        low: { type: 'number' },
        close: { type: 'number' },
        volume: { type: 'number' },
        openInterest: { type: 'number' },
    },
    required: [
        'key',
        'instrumentId',
        'interval',
        'timestamp',

        'open',
        'high',
        'low',
        'close',
        'volume',
        'openInterest',
    ],
    additionalProperties: false,
};

export const validateIndicator = ajv.compile(IndicatorSchema);
