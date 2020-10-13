import { Candle, Tick } from '../types';
import { CandleService } from './service';
import { CandleInterval } from '../types/candle';
import { toDayAndTime } from '../util';
import { CacheRepository } from '../database/repository/cache';
import { Interval } from 'luxon';
import { getDefaultSettings } from 'http2';
import { timeStamp } from 'console';
import { TickRepository } from '../database/repository/tick';
import { ExchangeService } from '../exchange/service';
import { CandleRepository } from '../database/repository/candle';
import { createSourceEventStream } from 'graphql';
import { curry } from 'lodash';
import { PrefService } from '../pref/service';

const _intervals = [
    CandleInterval.MIN_05,
    CandleInterval.MIN_10,
    CandleInterval.MIN_15,
    CandleInterval.MIN_30,
    CandleInterval.MIN_60,
    // CandleInterval.DAY_01,
];

class TickState {
    instrumentId: string;
    dayBegin?: boolean;
    timeCode?: number;
    currentCandleTime?: Date;
    currentCandleKey?: string;
    previousCandleKey?: string;
    updatedCandle?: Candle;
    otherCandleStates?: CandleState[];
    constructor(public tick: Tick) {
        this.instrumentId = tick.instrumentId;
    }
}

class CandleState {
    interval?: CandleInterval;
    timestamp?: Date;
    timeCode?: number;
    currentCandleKey?: string;
    previousCandleKey?: string;
    dayBegin?: boolean;
    updatedCandle?: Candle;
}

export class TickPipeline {
    private tickStateMap: Record<string, TickState> = {};
    private candleKeyList: string[] = [];
    private candleMap: Record<string, Candle> = {};
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

    prepareOtherCandleStates() {
        for (const instrumentId of this.instrumentIdList) {
            //Prepare other downres candles.
            const tickState = this.tickStateMap[instrumentId];
            const { exchange } = tickState.tick;
            tickState.otherCandleStates = _intervals.map(
                (interval): CandleState => {
                    const candleConfig = { ...tickState.tick, interval: CandleInterval.MIN_01 };

                    const timestamp = CandleService.getAlignedTime({
                        ...tickState.tick,
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
                    return {
                        interval,
                        timestamp,
                        currentCandleKey,
                        previousCandleKey,
                        dayBegin,
                    };
                },
            );
        }
    }

    async fetchCandles() {
        for (const instrumentId of this.instrumentIdList) {
            const { currentCandleKey, previousCandleKey, otherCandleStates } = this.tickStateMap[instrumentId];
            if (currentCandleKey) {
                this.candleKeyList.push(currentCandleKey);
                if (previousCandleKey) this.candleKeyList.push(previousCandleKey);
            }
            otherCandleStates?.map((candleState) => {
                if (candleState.currentCandleKey) this.candleKeyList.push(candleState.currentCandleKey);
                if (candleState.previousCandleKey) this.candleKeyList.push(candleState.previousCandleKey);
            });
        }
        const candleResults = await CacheRepository.getCandles(this.candleKeyList);
        for (const candle of candleResults) {
            if (candle != undefined) this.candleMap[candle.key] = candle;
        }
    }

    computeUpdatedCandle(instrumentId: string): void {
        const { tick, timeCode, currentCandleKey, previousCandleKey, currentCandleTime, dayBegin } = this.tickStateMap[
            instrumentId
        ];
        const { exchange } = tick;
        if (timeCode == undefined) throw new Error("timeCode can't be undefined");
        if (currentCandleKey == undefined) throw new Error("timeCode can't be undefined");
        if (currentCandleTime == undefined) throw new Error("currentCandleTime can't be undefined");
        if (dayBegin == undefined) throw new Error("dayBegin can't be undefined");
        const currentCandle = this.candleMap[currentCandleKey];
        const previousCandle = previousCandleKey != undefined ? this.candleMap[previousCandleKey] : undefined;
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

    computeDownResCandle({
        tickState,
        candleState,
        currentCandleKey,
        previousCandleKey,
    }: {
        tickState: TickState;
        candleState: CandleState;
        currentCandleKey: string;
        previousCandleKey: string;
    }) {
        const { updatedCandle: sourceCandle, tick } = tickState;
        const { exchange, instrumentId } = tick;
        if (sourceCandle == undefined) return;
        const { timestamp, interval, dayBegin } = candleState;
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

    computeDownResCandlesOfInstrument(tickState: TickState): void {
        const { updatedCandle: sourceCandle } = tickState;
        if (sourceCandle == undefined) return;
        tickState.otherCandleStates?.forEach((candleState, i) => {
            const { currentCandleKey, previousCandleKey } = candleState;
            if (currentCandleKey && previousCandleKey) {
                this.computeDownResCandle({
                    tickState,
                    candleState,
                    currentCandleKey,
                    previousCandleKey,
                });
            }
        });
    }

    computeDownResCandles(): void {
        for (const instrumentId of this.instrumentIdList) {
            this.computeDownResCandlesOfInstrument(this.tickStateMap[instrumentId]);
        }
    }

    async fetchUpdatedCandles(): Promise<Candle[]> {
        const updatedCandles: Candle[] = [];
        for (const instrumentId of this.instrumentIdList) {
            const { updatedCandle, otherCandleStates } = this.tickStateMap[instrumentId];
            if (updatedCandle != undefined) {
                updatedCandles.push(updatedCandle);
            }
            otherCandleStates?.forEach((candleState) => {
                if (candleState.updatedCandle != undefined) {
                    updatedCandles.push(candleState.updatedCandle);
                }
            });
        }
        const uniqueCandles: Record<string, Candle> = {};
        for (const candle of updatedCandles) {
            uniqueCandles[candle.key] = candle;
        }
        return Object.values(uniqueCandles);
    }

    async execute(): Promise<Candle[]> {
        this.prepareTicks();
        this.prepareOtherCandleStates();
        await this.fetchCandles();
        this.computeUpdatedCandles();
        this.computeDownResCandles();
        return this.fetchUpdatedCandles();
    }
}
