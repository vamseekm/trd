import { IsDate, IsDecimal, IsInt, IsNumber, IsString } from 'class-validator';

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

// export interface ITick {
//     instrumentId: string;
//     exchange: string;
//     tradingSymbol: string;
//     lastTradedPrice: number;
//     totalVolume: number;
//     totalBuyQuantity: number;
//     totalSellQuantity: number;
//     timestamp: Date;
//     time: number;
//     day: number;
//     lastTradeTimestamp: Date;
//     openInterest: number;
//     depth: {
//         buy: OrderItem[];
//         sell: OrderItem[];
//     };
// }
