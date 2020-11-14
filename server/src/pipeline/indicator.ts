import { AbstractIndicatorCalc } from '../indicator/calcs/base';
import { flattenIndicatorDependency } from '../indicator/calcs/lib';
import { defaultMacdIndicator } from '../indicator/calcs/macd';
import { CandleCacheRepository } from '../persistance/repository/cache-candle';
import { Candle, InstrumentConsts } from '../types';
import { CandleUtil } from '../util';

interface IndicatorState {
    sourceCandle: Candle;
    indicatorCalcList: AbstractIndicatorCalc[];
    candleFetchCount: number;
    indicatorFetchCount: number;
    prevCandleKeys: string[];
    prevIndicatorKeys: string[];
    updatedIndicator: Record<string, number>;
}

const indicatorCalcList: AbstractIndicatorCalc[] = [defaultMacdIndicator()];

export class IndicatorPipeline {
    indicatorStateList: IndicatorState[];
    constructor(sourceCandles: Candle[]) {
        this.indicatorStateList = sourceCandles.map((sourceCandle) => ({
            sourceCandle,
            indicatorCalcList: flattenIndicatorDependency(indicatorCalcList),
            candleFetchCount: 0,
            indicatorFetchCount: 0,
            prevCandleKeys: [],
            prevIndicatorKeys: [],
            updatedIndicator: {},
        }));
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
        const timeRecords: Record<string, string[]> = {};
        const start = Date.now();
        for (const indicatorState of this.indicatorStateList) {
            const { exchange, tradingSymbol, interval, timeCode } = CandleUtil.parseCandleKey(
                indicatorState.sourceCandle.key,
            );
            const timeRecordsKey = `${exchange}${InstrumentConsts.ID_SEPERATOR}${interval}`;
            if (timeRecords[timeRecordsKey] == undefined) {
                timeRecords[timeRecordsKey] = await CandleCacheRepository.readPreviousCandleTimeRecords({
                    exchange,
                    interval,
                    timeCode,
                    count: Math.max(indicatorState.indicatorFetchCount, indicatorState.candleFetchCount),
                });
            }
            const candleKeys = timeRecords[timeRecordsKey].map((timeCode) => {
                return CandleUtil.makeCandleKey({ exchange, tradingSymbol, timeCode, interval });
            });
            indicatorState.prevCandleKeys = [...candleKeys];
            indicatorState.prevIndicatorKeys = [...candleKeys];
        }
        console.log(Date.now() - start);
    }

    async execute(): Promise<any> {
        this.prepare();
        await this.fetch();
    }
}
