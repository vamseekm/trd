export interface OrderItem {
    quantity: number;
    price: number;
    orders: number;
}
export interface ITick {
    globalSymbol: string;
    exchange: string;
    tradingSymbol: string;
    lastTradedPrice: number;
    totalVolume: number;
    totalBuyQuantity: number;
    totalSellQuantity: number;
    timestamp: Date;
    time: number;
    day: number;
    lastTradeTimestamp: Date;
    openInterest: number;
    depth: {
        buy: OrderItem[];
        sell: OrderItem[];
    };
}
