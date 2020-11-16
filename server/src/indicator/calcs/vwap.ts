import { Indicator } from '../../types';
import { AbstractIndicatorCalc, IndicatorCalcParams } from './base';
export class TotalValueCalc extends AbstractIndicatorCalc {
    constructor() {
        super({ id: `totalValue`, intervals: 1 });
    }

    calculateWithParams({
        currentIndicator,
        combinedPrevious,
        combinedCurrent,
        sameDay,
    }: IndicatorCalcParams): Indicator {
        const previousTotalValue = combinedPrevious?.[this.id];
        if (previousTotalValue == undefined || sameDay === false) {
            currentIndicator.values[this.id] = combinedCurrent[this.field] * combinedCurrent['volume'];
            return currentIndicator;
        }
        const currentTotalValue = previousTotalValue + combinedCurrent[this.field] * combinedCurrent['volume'];
        currentIndicator.values[this.id] = currentTotalValue;
        return currentIndicator;
    }
}
export class VWapIndicatorCalc extends AbstractIndicatorCalc {
    tv: TotalValueCalc;
    constructor() {
        super({ id: 'vwap', intervals: 1 });
        this.tv = new TotalValueCalc();
        this.addSubIndicator(this.tv);
    }

    calculateWithParams({ combinedCurrent, currentIndicator }: IndicatorCalcParams): Indicator {
        currentIndicator.values[this.id] = Number.parseFloat(
            (combinedCurrent[this.tv.id] / combinedCurrent['totalVolume']).toFixed(4),
        );
        return currentIndicator;
    }
}
