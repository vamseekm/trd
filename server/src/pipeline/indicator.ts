import { AbstractIndicatorCalc } from '../indicator/calcs/base';
import { flattenIndicatorDependency } from '../indicator/calcs/lib';
import { SmaIndicatorCalc } from '../indicator/calcs/ma';
import { VWapIndicatorCalc } from '../indicator/calcs/vwap';
import { CandleCacheRepository } from '../persistance/repository/cache-candle';
import { IndicatorCacheRepository } from '../persistance/repository/cache-indicator';
import { Candle, Indicator } from '../types';
import { CandleUtil } from '../util';

interface IndicatorState {
    sourceCandle: Candle;
    indicatorCalcList: AbstractIndicatorCalc[];
    candleFetchCount: number;
    indicatorFetchCount: number;
    prevKeys: string[];
    updatedIndicator: Indicator;
}

const DEFAULT_INDICATORS: AbstractIndicatorCalc[] = [
    new SmaIndicatorCalc({ field: 'close', intervals: 8 }),
    new VWapIndicatorCalc(),
];

export class IndicatorPipeline {
    indicatorStateList: IndicatorState[] = [];
    candleMap: Record<string, Candle> = {};
    indicatorMap: Record<string, Indicator> = {};
    constructor(sourceCandles: Candle[], indicatorCalcList?: AbstractIndicatorCalc[]) {
        indicatorCalcList = indicatorCalcList || DEFAULT_INDICATORS;
        for (const sourceCandle of sourceCandles) {
            this.candleMap[sourceCandle.key] = sourceCandle;
            this.indicatorStateList.push({
                sourceCandle,
                indicatorCalcList: flattenIndicatorDependency(indicatorCalcList),
                candleFetchCount: 0,
                indicatorFetchCount: 0,
                prevKeys: [],
                updatedIndicator: { key: '', values: {} },
            });
        }
    }

    prepare(): void {
        for (const indicatorState of this.indicatorStateList) {
            for (const indicator of indicatorState.indicatorCalcList) {
                indicatorState.candleFetchCount = Math.max(indicatorState.candleFetchCount, indicator.candleFetchCount);
                indicatorState.indicatorFetchCount = Math.max(
                    indicatorState.indicatorFetchCount,
                    indicator.indicatorFetchCount,
                );
            }
        }
    }

    async fetch(): Promise<void> {
        const timeRecordsCache: Record<string, string[]> = {};
        // const start = Date.now();
        const allCandleKeySet = new Set<string>();
        const allIndicatorKeySet = new Set<string>();
        for (const indicatorState of this.indicatorStateList) {
            indicatorState.updatedIndicator.key = indicatorState.sourceCandle.key;
            const { exchange, tradingSymbol, interval, timeCode } = CandleUtil.parseCandleKey(
                indicatorState.sourceCandle.key,
            );
            const timeRecordsKey = `${exchange}-${interval}-${timeCode}`;
            if (timeRecordsCache[timeRecordsKey] == undefined) {
                timeRecordsCache[timeRecordsKey] = await CandleCacheRepository.readPreviousCandleTimeRecords({
                    exchange,
                    interval,
                    timeCode,
                    count: Math.max(indicatorState.indicatorFetchCount, indicatorState.candleFetchCount) + 1,
                });
            }
            const candleKeys = timeRecordsCache[timeRecordsKey].map((timeCode) => {
                return CandleUtil.makeCandleKey({ exchange, tradingSymbol, timeCode, interval });
            });
            indicatorState.prevKeys = [...candleKeys];
            indicatorState.prevKeys.forEach(allCandleKeySet.add.bind(allCandleKeySet));
            indicatorState.prevKeys.forEach(allIndicatorKeySet.add.bind(allIndicatorKeySet));
        }
        const allCandleKeys = [...allCandleKeySet];
        const allCandles = await CandleCacheRepository.getCandles(allCandleKeys);
        for (const [i, candleKey] of allCandleKeys.entries()) {
            const candle = allCandles[i];
            if (candle != undefined) this.candleMap[candleKey] = candle;
        }
        const allIndicatorKeys = [...allIndicatorKeySet];
        const allIndicators = await IndicatorCacheRepository.getIndicators(allIndicatorKeys);
        for (const [i, indicatorKey] of allIndicatorKeys.entries()) {
            const indicator = allIndicators[i];
            this.indicatorMap[indicatorKey] = indicator || { key: indicatorKey, values: {} };
        }
        for (const { sourceCandle } of this.indicatorStateList) {
            this.candleMap[sourceCandle.key] = sourceCandle;
        }
    }

    calculateIndicator(indicatorState: IndicatorState): void {
        for (const indicatorCalc of indicatorState.indicatorCalcList) {
            const candleList = indicatorState.prevKeys.map((candleKey) => this.candleMap[candleKey]);
            if (candleList[0] == undefined) {
                console.log(indicatorState.sourceCandle.key);
                console.log(indicatorState.prevKeys);
            }
            const indicatorList = indicatorState.prevKeys.map((indicatorKey) => this.indicatorMap[indicatorKey]);
            const updatedIndicator = indicatorCalc.calculate(candleList, indicatorList);
            this.indicatorMap[updatedIndicator.key] = updatedIndicator;
            indicatorState.updatedIndicator = updatedIndicator;
        }
    }

    calculate(): void {
        for (const indicatorState of this.indicatorStateList) {
            this.calculateIndicator(indicatorState);
        }
    }

    async getUpdatedIndicators(): Promise<Indicator[]> {
        return this.indicatorStateList.map(({ updatedIndicator }) => updatedIndicator);
    }

    async execute(): Promise<Indicator[]> {
        this.prepare();
        await this.fetch();
        this.calculate();
        return this.getUpdatedIndicators();
    }
}
