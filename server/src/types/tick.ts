import Ajv from 'ajv';
const ajv = new Ajv({ allErrors: true });
import { IsDate, IsDecimal, IsInt, IsNumber, IsString } from 'class-validator';

import { ExchangeService } from '../exchange/service';

export class OrderItem {
    @IsInt()
    quantity!: number;
    @IsDecimal()
    price!: number;
    @IsInt()
    orders!: number;
}

export class Tick {
    @IsString()
    instrumentId!: string;
    @IsString()
    exchange!: string;
    @IsString()
    tradingSymbol!: string;
    @IsNumber()
    lastTradedPrice!: number;
    @IsInt()
    totalVolume!: number;
    @IsInt()
    totalBuyQuantity!: number;
    @IsInt()
    totalSellQuantity!: number;
    @IsDate()
    timestamp!: Date;
    @IsInt()
    time!: number;
    @IsInt()
    day!: number;
    @IsDate()
    lastTradeTimestamp!: Date;
    @IsInt()
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
