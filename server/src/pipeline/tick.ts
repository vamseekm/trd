import { isPresent } from 'ts-is-present';

import { CandleCacheRepository } from '../persistance';
import { Candle, CandleInterval, Tick } from '../types';
import { CandleUtil, toDayAndTime } from '../util';

interface TickState {
    tick: Tick;
    instrumentId: string;
    dayBegin: boolean;
    timeCode: number;
    currentCandleTime: Date;
    currentCandleKey: string;
    previousCandleKey: string;
    updatedCandle?: Candle;
}

export class TickPipeline {
    private tickStateList: TickState[] = [];
    private candleMap: Record<string, Candle> = {};
    constructor(public _ticks: Tick[]) {}

    prepareTicks(): void {
        for (const tick of this._ticks) {
            const { instrumentId } = tick;
            const candleConfig = { ...tick, interval: CandleInterval.MIN_01 };
            const currentCandleTime = CandleUtil.getAlignedTime(candleConfig);
            const { timeCode } = toDayAndTime(currentCandleTime);
            const { key: currentCandleKey, dayBegin } = CandleUtil.getCandleMetaProperties({
                ...candleConfig,
                timestamp: currentCandleTime,
            });
            if (currentCandleKey == undefined) continue;

            const previousCandleTime = CandleUtil.getAlignedTime({ ...candleConfig, offset: -1 });
            const { key: previousCandleKey } = CandleUtil.getCandleMetaProperties({
                ...candleConfig,
                timestamp: previousCandleTime,
            });

            const tickState = {
                tick,
                instrumentId,
                currentCandleTime,
                currentCandleKey,
                dayBegin,
                timeCode,
                previousCandleKey,
            };
            this.tickStateList.push(tickState);
        }
    }

    async fetchCandles(): Promise<void> {
        const candleKeys: string[] = this.tickStateList
            .flatMap((tickState) => [tickState.currentCandleKey, tickState.previousCandleKey])
            .filter(isPresent);
        const candleResults = await CandleCacheRepository.getCandles(candleKeys);
        candleResults.filter(isPresent).forEach((candle) => {
            this.candleMap[candle.key] = candle;
        });
    }

    computeUpdatedCandle(tickState: TickState): void {
        const {
            instrumentId,
            tick,
            timeCode,
            currentCandleKey,
            previousCandleKey,
            currentCandleTime,
            dayBegin,
        } = tickState;
        const { exchange } = tick;
        const currentCandle = this.candleMap[currentCandleKey];
        const previousCandle = this.candleMap[previousCandleKey];
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
            tickState.updatedCandle = updatedCandle;
            return;
        }
        const keys = Object.keys(updatedCandle);
        for (const key of keys) {
            if (key === 'timestamp') continue;
            if ((currentCandle as any)[key] !== (updatedCandle as any)[key]) {
                tickState.updatedCandle = updatedCandle;
                return;
            }
        }
    }

    computeUpdatedCandles(): void {
        for (const tickState of this.tickStateList) {
            this.computeUpdatedCandle(tickState);
        }
    }

    async fetchUpdatedCandles(): Promise<Candle[]> {
        const results = this.tickStateList
            .map((tickState) => tickState.updatedCandle)
            .filter(isPresent)
            .reduce((candleMap: Record<string, Candle>, candle) => {
                candleMap[candle.key] = candle;
                return candleMap;
            }, {});
        return Object.values(results);
    }

    async execute(): Promise<Candle[]> {
        this.prepareTicks();
        await this.fetchCandles();
        this.computeUpdatedCandles();
        return this.fetchUpdatedCandles();
    }
}
