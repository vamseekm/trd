export interface OrderItem {
    quantity: number;
    price: number;
    orders: number;
}
export interface ITick {
    globalSymbol: string;
    lastTradedPrice: number;
    totalVolume: number;
    totalBuyQuantity: number;
    totalSellQuantity: number;
    timestamp: number;
    lastTradeTimestamp: number;
    openInterest: number;
    depth: {
        buy: OrderItem[];
        sell: OrderItem[];
    };
}
