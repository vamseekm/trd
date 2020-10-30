import { newValidator } from './validator';

export class OrderItem {
    quantity!: number;
    price!: number;
    orders!: number;
}

export class Tick {
    instrumentId!: string;
    exchange!: string;
    tradingSymbol!: string;
    lastTradedPrice!: number;
    totalVolume!: number;
    totalBuyQuantity!: number;
    totalSellQuantity!: number;
    timestamp!: Date;
    time!: number;
    day!: number;
    lastTradeTimestamp!: Date;
    openInterest!: number;
    depth!: {
        buy: OrderItem[];
        sell: OrderItem[];
    };
}

const TickSchema = {
    properties: {
        instrumentId: { type: 'string' },
        exchange: { type: 'string' },
        tradingSymbol: { type: 'string' },
        lastTradedPrice: { type: 'number' },
        totalVolume: { type: 'number' },
        totalBuyQuantity: { type: 'number' },
        totalSellQuantity: { type: 'number' },
        timestamp: { instanceof: 'Date' },
        time: { type: 'number' },
        day: { type: 'number' },
        lastTradeTimestamp: { instanceof: 'Date' },
        openInterest: { type: 'number' },
        depth: { type: 'object' },
    },
    required: [
        'instrumentId',
        'exchange',
        'tradingSymbol',
        'lastTradedPrice',
        'totalVolume',
        'totalBuyQuantity',
        'totalSellQuantity',
        'timestamp',
        'time',
        'day',
        'lastTradeTimestamp',
        'openInterest',
    ],
    additionalProperties: false,
};

export const validateTick = newValidator().compile(TickSchema);
