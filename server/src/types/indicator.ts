// import { newValidator } from './validator';
// const ajv = newValidator();

export interface Indicator {
    key: string;
    values: Record<string, number>;
}

// const IndicatorSchema = {
//     properties: {
//         key: { type: 'string' },
//         instrumentId: { type: 'string' },
//         interval: { type: 'string' },
//         timestamp: { type: 'object' },

//         open: { type: 'number' },
//         high: { type: 'number' },
//         low: { type: 'number' },
//         close: { type: 'number' },
//         volume: { type: 'number' },
//         openInterest: { type: 'number' },
//     },
//     required: [
//         'key',
//         'instrumentId',
//         'interval',
//         'timestamp',

//         'open',
//         'high',
//         'low',
//         'close',
//         'volume',
//         'openInterest',
//     ],
//     additionalProperties: false,
// };

// export const validateIndicator = ajv.compile(IndicatorSchema);
