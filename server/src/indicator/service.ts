import { IndicatorCacheRepository } from '../persistance/repository/cache-indicator';
import { Candle } from '../types';

async function processCandles(candles: Candle[]): Promise<void> {
    console.log(candles.length);
}

async function flushCache(): Promise<unknown> {
    return IndicatorCacheRepository.flush();
}

export const IndicatorService = {
    processCandles,
    flushCache,
};
