export enum CandleInterval {
    MIN_01 = 'M1',
    MIN_05 = 'M5',
    MIN_10 = 'M10',
    MIN_15 = 'M15',
    MIN_30 = 'M30',
    MIN_60 = 'M60',
    DAY_01 = 'D1',
}

export interface IBrokerCandle {
    date: Date;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
}
