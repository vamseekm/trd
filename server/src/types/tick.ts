import Ajv from 'ajv';
const ajv = new Ajv({ allErrors: true });

import { ExchangeService } from '../exchange/service';

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
        timestamp: { type: 'object' },
        time: { type: 'number' },
        day: { type: 'number' },
        lastTradeTimestamp: { type: 'object' },
        openInterest: { type: 'number' },
        depth: { type: 'object' },
    },
};

export const validateTick = ajv.compile(TickSchema);
