import { CandleCacheRepository } from '../database';
import { Candle, CandleInterval } from '../types';
import { toDayAndTime } from '../util';
import { CandleService } from './service';

const _intervals = [
    CandleInterval.MIN_05,
    CandleInterval.MIN_10,
    CandleInterval.MIN_15,
    CandleInterval.MIN_30,
    CandleInterval.MIN_60,
];

class CandleState {
    interval?: CandleInterval;
    timestamp?: Date;
    sourceCandleKey?: string;
    currentCandleKey?: string;
    previousCandleKey?: string;
    dayBegin?: boolean;
    updatedCandle?: Candle;
}

export class DownResolutionPipeline {
    private candleStateList: CandleState[] = [];
    private candleMap: Record<string, Candle> = {};
    constructor(private sourceCandleList: Candle[]) {}

    prepareCandles(): void {
        for (const sourceCandle of this.sourceCandleList) {
            this.candleMap[sourceCandle.key] = sourceCandle;
            const { instrumentId, exchange } = sourceCandle;
            for (const interval of _intervals) {
                const timestamp = CandleService.getAlignedTime({
                    ...sourceCandle,
                    interval,
                });
                const { key: currentCandleKey, dayBegin } = CandleService.getCandleMetaProperties({
                    instrumentId,
                    interval,
                    timestamp,
                });
                const { key: previousCandleKey } = CandleService.getCandleMetaProperties({
                    instrumentId,
                    interval,
                    timestamp: CandleService.getAlignedTime({
                        exchange,
                        timestamp,
                        interval,
                        offset: -1,
                    }),
                });
                this.candleStateList.push({
                    interval,
                    timestamp,
                    sourceCandleKey: sourceCandle.key,
                    currentCandleKey,
                    previousCandleKey,
                    dayBegin,
                });
            }
        }
    }

    async fetchCandles(): Promise<void> {
        const candleKeys: string[] = [];
        for (const candleState of this.candleStateList) {
            if (candleState.currentCandleKey) {
                candleKeys.push(candleState.currentCandleKey);
                if (candleState.previousCandleKey) candleKeys.push(candleState.previousCandleKey);
            }
        }
        if (candleKeys.length === 0) return;
        const candleResults = await CandleCacheRepository.getCandles(candleKeys);
        for (const candle of candleResults) {
            if (candle != undefined) this.candleMap[candle.key] = candle;
        }
    }

    // eslint-disable-next-line sonarjs/cognitive-complexity
    computeDownResCandle(candleState: CandleState): void {
        const { sourceCandleKey, currentCandleKey, previousCandleKey } = candleState;
        if (sourceCandleKey == undefined) return;
        const sourceCandle = this.candleMap[sourceCandleKey];
        if (sourceCandle == undefined) return;
        const { exchange, instrumentId } = sourceCandle;
        if (sourceCandle == undefined) return;
        const { timestamp, interval, dayBegin } = candleState;
        if (currentCandleKey == undefined) throw new Error("currentCandleKey can't be null");
        if (previousCandleKey == undefined) throw new Error("previousCandleKey can't be null");
        if (timestamp == undefined) throw new Error("timestamp can't be undefined");
        if (interval == undefined) throw new Error("interval can't be undefined");
        const { timeCode } = toDayAndTime(timestamp);
        const atBegin = timeCode === sourceCandle.timeCode;
        const currentCandle = this.candleMap[currentCandleKey];
        const updatedCandle: Candle = {
            key: currentCandleKey,
            exchange,
            instrumentId,
            timeCode,
            interval,
            timestamp,
            open: atBegin ? sourceCandle.open : currentCandle?.open || sourceCandle.open,
            high: Math.max(sourceCandle.high, currentCandle?.high || sourceCandle.high),
            low: Math.min(sourceCandle.low, currentCandle?.low || sourceCandle.low),
            close: sourceCandle.close,
            volume: sourceCandle.totalVolume,
            openInterest: sourceCandle.totalOpenInterest,
            totalVolume: sourceCandle.totalVolume,
            totalOpenInterest: sourceCandle.totalOpenInterest,
        };
        const previousCandle = this.candleMap[previousCandleKey];
        if (dayBegin === false && previousCandle != undefined) {
            updatedCandle.volume = updatedCandle.totalVolume - previousCandle.totalVolume;
            updatedCandle.openInterest = updatedCandle.totalVolume - previousCandle.totalVolume;
        }
        if (currentCandle == undefined) {
            candleState.updatedCandle = updatedCandle;
            return;
        }
        const keys = Object.keys(updatedCandle);
        for (const key of keys) {
            if (key === 'timestamp') continue;
            if ((currentCandle as any)[key] !== (updatedCandle as any)[key]) {
                candleState.updatedCandle = updatedCandle;
                return;
            }
        }
    }

    async fetchUpdatedCandles(): Promise<Candle[]> {
        const updatedCandles: Candle[] = [];
        for (const candleState of this.candleStateList) {
            const { updatedCandle } = candleState;
            if (updatedCandle != undefined) updatedCandles.push(updatedCandle);
        }
        const uniqueCandles: Record<string, Candle> = {};
        for (const candle of updatedCandles) {
            uniqueCandles[candle.key] = candle;
        }
        return Object.values(uniqueCandles);
    }

    computeDownResCandles(): void {
        this.candleStateList.forEach((candleState) => this.computeDownResCandle(candleState));
    }

    async execute(): Promise<Candle[]> {
        this.prepareCandles();
        await this.fetchCandles();
        this.computeDownResCandles();
        return this.fetchUpdatedCandles();
    }
}
