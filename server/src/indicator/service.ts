import { CacheRepository } from '../database/repository/cache';
import { CandleRepository } from '../database/repository/candle';
import { Candle } from '../types';

async function processCandle(candle: Candle): Promise<void> {}

async function processCandles(candles: Candle[]): Promise<void> {
    console.log(candles.length);
    for (const candle of candles) {
    }
}

export const IndicatorService = {
    processCandles,
};
