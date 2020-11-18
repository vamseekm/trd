/* eslint-disable @typescript-eslint/no-unused-vars */
import { Candle, Indicator } from '../../types';
import { assertNotUndefined } from '../../util';
import { toDayAndTime } from '../../util/time';
export interface IndicatorCalcParams {
    combinedCurrent: Record<string, number>;
    combinedPrevious: Record<string, number>;
    previousIndicator?: Indicator;
    previousCandle?: Candle;
    currentCandle: Candle;
    currentIndicator: Indicator;
    candleList: Candle[];
    indicatorList: Indicator[];
    sameDay: boolean;
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
        const combinedCurrent = Object.assign({}, candleList[0] || {}, indicatorList[0]?.values || {});
        const combinedPrevious = Object.assign({}, candleList[1] || {}, indicatorList[1]?.values || {});
        const sameDay =
            combinedCurrent.timeCode != undefined &&
            combinedPrevious.timeCode != undefined &&
            toDayAndTime(combinedCurrent.timestamp).day === toDayAndTime(combinedPrevious.timestamp).day;
        if (combinedCurrent[this.field] == undefined) {
            console.trace('currentCandle.field is undefined');
            console.log('Current:', candleList);
            console.log('Combined current:', combinedCurrent);
            console.log('combined previous:', combinedPrevious);
        }
        assertNotUndefined('currentValue', combinedCurrent[this.field]);
        const currentIndicator = indicatorList[0];
        const currentCandle = candleList[0];
        const { close, totalVolume, volume, open, high, low } = currentCandle;
        currentIndicator.values = { ...currentIndicator.values, open, high, low, close, totalVolume, volume };
        return this.calculateWithParams({
            combinedCurrent,
            combinedPrevious,
            currentCandle,
            currentIndicator,
            previousCandle: candleList[1],
            previousIndicator: indicatorList[1],
            candleList,
            indicatorList,
            sameDay,
        });
    }

    public calculateWithParams(_params: IndicatorCalcParams): Indicator {
        throw new Error(`${this.id} not yet implemented`);
    }
}
