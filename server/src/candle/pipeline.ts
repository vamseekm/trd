import { Candle, Tick } from '../types';
import { CandleService } from './service';
import { CandleInterval } from '../types/candle';
import { toDayAndTime } from '../util';
import { CacheRepository } from '../database/repository/cache';

class TickState {
    instrumentId: string;
    dayBegin?: boolean;
    timeCode?: number;
    currentCandleTime?: Date;
    currentCandleKey?: string;
    previousCandleKey?: string;
    previousCandle?: Candle;
    currentCandle?: Candle;
    updatedCandle?: Candle;
    constructor(public tick: Tick) {
        this.instrumentId = tick.instrumentId;
    }
}

export class TickPipeline {
    private tickStateMap: Record<string, TickState> = {};
    private instrumentIdList: string[] = [];
    constructor(_ticks: Tick[]) {
        for (const tick of _ticks) {
            this.tickStateMap[tick.instrumentId] = new TickState(tick);
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
            tickState.currentCandleTime = currentCandleTime;
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
        const currentCandleKeys: string[] = [];
        const previousCandleKeys: string[] = [];
        const instrumentsWithCandles: string[] = [];
        for (const instrumentId of this.instrumentIdList) {
            const { currentCandleKey, previousCandleKey } = this.tickStateMap[instrumentId];
            if (currentCandleKey && previousCandleKey) {
                instrumentsWithCandles.push(instrumentId);
                currentCandleKeys.push(currentCandleKey);
                previousCandleKeys.push(previousCandleKey);
            }
        }
        const [previousCandles, currentCandles] = await Promise.all([
            CacheRepository.getCandles(previousCandleKeys),
            CacheRepository.getCandles(currentCandleKeys),
        ]);
        for (const [index, instrumentId] of instrumentsWithCandles.entries()) {
            this.tickStateMap[instrumentId].previousCandle = previousCandles[index];
            this.tickStateMap[instrumentId].currentCandle = currentCandles[index];
        }
    }

    computeUpdatedCandle(instrumentId: string): void {
        const {
            tick,
            timeCode,
            currentCandleKey,
            currentCandleTime,
            currentCandle,
            previousCandle,
            dayBegin,
        } = this.tickStateMap[instrumentId];
        const { exchange } = tick;
        if (timeCode == undefined) throw new Error("timeCode can't be undefined");
        if (currentCandleKey == undefined) throw new Error("timeCode can't be undefined");
        if (currentCandleTime == undefined) throw new Error("currentCandleTime can't be undefined");
        if (dayBegin == undefined) throw new Error("dayBegin can't be undefined");
        const updatedCandle: Candle = {
            instrumentId,
            exchange,
            interval: CandleInterval.MIN_01,
            timeCode,
            key: currentCandleKey,
            timestamp: currentCandleTime,
            open: currentCandle?.open || tick.lastTradedPrice,
            high: Math.max(currentCandle?.high || tick.lastTradedPrice, tick.lastTradedPrice),
            low: Math.min(currentCandle?.low || tick.lastTradedPrice, tick.lastTradedPrice),
            close: tick.lastTradedPrice,
            volume: tick.totalVolume,
            totalVolume: tick.totalVolume,
            totalOpenInterest: tick.openInterest,
            openInterest: tick.openInterest,
        };
        if (dayBegin === false && previousCandle != undefined) {
            updatedCandle.volume = updatedCandle.totalVolume - previousCandle.totalVolume;
            updatedCandle.openInterest = updatedCandle.totalOpenInterest - previousCandle.totalOpenInterest;
        }
        if (currentCandle == undefined) {
            this.tickStateMap[instrumentId].updatedCandle = updatedCandle;
            return;
        }
        const keys = Object.keys(updatedCandle);
        for (const key of keys) {
            if (key === 'timestamp') continue;
            if ((currentCandle as any)[key] !== (updatedCandle as any)[key]) {
                this.tickStateMap[instrumentId].updatedCandle = updatedCandle;
                return;
            }
        }
    }

    computeUpdatedCandles(): void {
        for (const instrumentId of this.instrumentIdList) {
            this.computeUpdatedCandle(instrumentId);
        }
    }

    async fetchUpdatedCandles(): Promise<Candle[]> {
        const updatedCandles: Candle[] = [];
        for (const instrumentId of this.instrumentIdList) {
            const { updatedCandle } = this.tickStateMap[instrumentId];
            if (updatedCandle != undefined) {
                updatedCandles.push(updatedCandle);
            }
        }
        return updatedCandles;
    }

    async execute(): Promise<Candle[]> {
        this.prepareTicks();
        await this.fetchCandles();
        this.computeUpdatedCandles();
        return this.fetchUpdatedCandles();
    }
}
