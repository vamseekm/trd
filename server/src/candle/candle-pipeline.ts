import { Candle, Tick } from '../types';
import { CandleService } from './service';
import { CandleInterval } from '../types/candle';
import { toDayAndTime } from '../util';
import { CacheGroup } from '../database/repository/cache-group';
import { CacheRepository } from '../database/repository/cache';
import { RedisService } from '../infra/redis';

class TickPipelineState {
    instrumentId: string;
    currentCandleKey?: string;
    dayBegin?: boolean;
    timeCode?: number;
    previousCandleKey?: string;
    constructor(public tick: Tick) {
        this.instrumentId = tick.instrumentId;
    }
}

export class TickPipeline {
    private tickStateMap: Record<string, TickPipelineState> = {};
    private instrumentIdList: string[] = [];
    private resultCandles: Candle[] = [];
    constructor(_ticks: Tick[]) {
        for (const tick of _ticks) {
            this.tickStateMap[tick.instrumentId] = new TickPipelineState(tick);
            this.instrumentIdList.push(tick.instrumentId);
        }
    }

    prepareTicks() {
        for (const instrumentId of this.instrumentIdList) {
            const tickState = this.tickStateMap[instrumentId];
            const candleConfig = { ...tickState.tick, interval: CandleInterval.MIN_01 };
            const currentCandleTime = CandleService.getAlignedTime(candleConfig);
            const { timeCode } = toDayAndTime(currentCandleTime);
            const { key: currentCandleKey, dayBegin } = CandleService.getCandleMetaProperties({
                ...candleConfig,
                timestamp: currentCandleTime,
            });
            if (currentCandleKey == undefined) continue;
            tickState.currentCandleKey = currentCandleKey;
            tickState.dayBegin = dayBegin;
            tickState.timeCode = timeCode;
            if (currentCandleKey == undefined) return;
            const previousCandleTime = CandleService.getAlignedTime({ ...candleConfig, offset: -1 });
            const { key: previousCandleKey } = CandleService.getCandleMetaProperties({
                ...candleConfig,
                timestamp: previousCandleTime,
            });
            tickState.previousCandleKey = previousCandleKey;
        }
    }

    async fetchCandles() {
        const candleKeys: string[] = [];
        for (const instrumentId of this.instrumentIdList) {
            const tickState = this.tickStateMap[instrumentId];
            if (tickState.currentCandleKey != undefined) candleKeys.push(tickState.currentCandleKey);
        }
        const candles = await CacheRepository.getCandles(candleKeys);
        console.log(candles);
        // const candles = await RedisService.mget(candleKeys);
        // console.log(candles);
        // console.log(candles);
        // console.log(candleKeys);
    }

    async execute(): Promise<Candle[]> {
        this.prepareTicks();
        await this.fetchCandles();
        return this.resultCandles;
    }
}

// // Log.pretty(tick);
// const candleConfig = { ...tick, interval };
// const currentCandleTime = await getAlignedTime(candleConfig);
// const { timeCode } = toDayAndTime(currentCandleTime);
// const { key: currentCandleKey, dayBegin } = await getCandleMetaProperties({
//     ...candleConfig,
//     timestamp: currentCandleTime,
// });
// if (currentCandleKey == undefined) return;
// const previousCandleTime = await getAlignedTime({ ...candleConfig, offset: -1 });
// const { key: previousCandleKey } = await getCandleMetaProperties({
//     ...candleConfig,
//     timestamp: previousCandleTime,
// });
// Log.info(currentCandleKey);
// console.time(currentCandleKey);
// _active += 1;
// const [previousCandle, currentCandle] = await Promise.all([
//     CacheRepository.getCandle(previousCandleKey),
//     CacheRepository.getCandle(currentCandleKey),
// ]);

// const { instrumentId, exchange } = tick;
// const updatedCandle: Candle = {
//     instrumentId,
//     exchange,
//     interval,
//     timeCode,
//     key: currentCandleKey,
//     timestamp: currentCandleTime,
//     open: currentCandle?.open || tick.lastTradedPrice,
//     high: Math.max(currentCandle?.high || tick.lastTradedPrice, tick.lastTradedPrice),
//     low: Math.min(currentCandle?.low || tick.lastTradedPrice, tick.lastTradedPrice),
//     close: tick.lastTradedPrice,
//     volume: tick.totalVolume,
//     totalVolume: tick.totalVolume,
//     totalOpenInterest: tick.openInterest,
//     openInterest: tick.openInterest,
// };
// if (dayBegin === false && previousCandle != undefined) {
//     updatedCandle.volume = updatedCandle.totalVolume - previousCandle.totalVolume;
//     updatedCandle.openInterest = updatedCandle.totalOpenInterest - previousCandle.totalOpenInterest;
// }
// _active -= 1;
// Log.info('End:', `${_active}`);
// console.timeEnd(currentCandleKey);

// return updatedCandle;
