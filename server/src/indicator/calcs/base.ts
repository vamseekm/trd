/* eslint-disable @typescript-eslint/no-unused-vars */
import { Candle, Indicator } from '../../types';
export interface IndicatorCalcParams {
    combinedCurrent: Record<string, number>;
    combinedPrevious: Record<string, number>;
    previousIndicator?: Indicator;
    previousCandle?: Candle;
    currentCandle: Candle;
    currentIndicator: Indicator;
    candleList: Candle[];
    indicatorList: Indicator[];
}
export class AbstractIndicatorCalc {
    id: string;
    field: string;
    intervals: number;
    candleFetchCount: number;
    indicatorFetchCount: number;
    subIndicators: AbstractIndicatorCalc[] = [];

    constructor({
        id,
        intervals,
        field = 'close',
        prevCandleCount = 1,
        prevIndicatorCount = 1,
    }: {
        id: string;
        intervals: number;
        field?: string;
        prevCandleCount?: number;
        prevIndicatorCount?: number;
    }) {
        this.id = id;
        this.intervals = intervals;
        this.field = field;
        this.candleFetchCount = prevCandleCount;
        this.indicatorFetchCount = prevIndicatorCount;
    }

    public addSubIndicator(subIndicator: AbstractIndicatorCalc): void {
        this.subIndicators.push(subIndicator);
    }

    public getExecutionOrder(): AbstractIndicatorCalc[] {
        const allSubIndicators: AbstractIndicatorCalc[] = [];
        for (const subIndicator of this.subIndicators) {
            allSubIndicators.push(...subIndicator.getExecutionOrder());
        }
        return [...allSubIndicators, this];
    }

    public calculate(candleList: Candle[], indicatorList: Indicator[]): Indicator {
        return this.calculateWithParams({
            combinedCurrent: Object.assign({}, candleList[0] || {}, indicatorList[0]?.values || {}),
            combinedPrevious: Object.assign({}, candleList[1] || {}, indicatorList[1]?.values || {}),
            currentCandle: candleList[0],
            previousCandle: candleList[1],
            currentIndicator: indicatorList[0],
            previousIndicator: indicatorList[1],
            candleList,
            indicatorList,
        });
    }

    public calculateWithParams(_params: IndicatorCalcParams): Indicator {
        throw new Error(`${this.id} not yet implemented`);
    }
}
