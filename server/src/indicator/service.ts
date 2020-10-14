import { Candle } from '../types';

async function processCandles(candles: Candle[]): Promise<void> {
    console.log(candles.length);
}

export const IndicatorService = {
    processCandles,
};
