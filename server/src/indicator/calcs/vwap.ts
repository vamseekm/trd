import { Indicator } from '../../types';
import { assertNotUndefined } from '../../util/lib/algo-ds';
import { truncateFloat } from '../../util/nums/nums';
import { AbstractIndicatorCalc, IndicatorCalcParams } from './base';

export class TypicalPriceCalc extends AbstractIndicatorCalc {
    constructor() {
        super({ id: 'typicalPrice', intervals: 1 });
    }

    calculateWithParams({ combinedCurrent, currentIndicator }: IndicatorCalcParams): Indicator {
        const { high, low, close } = combinedCurrent;
        assertNotUndefined(high);
        assertNotUndefined(low);
        assertNotUndefined(low);
        currentIndicator.values[this.id] = truncateFloat((high + low + close) / 3);
        return currentIndicator;
    }
}
export class TotalValueCalc extends AbstractIndicatorCalc {
    typeicalPrice: TypicalPriceCalc = new TypicalPriceCalc();
    constructor() {
        super({ id: `totalValue`, intervals: 1, field: 'typicalPrice' });
        this.addSubIndicator(this.typeicalPrice);
    }

    calculateWithParams({
        currentIndicator,
        combinedPrevious,
        combinedCurrent,
        sameDay,
    }: IndicatorCalcParams): Indicator {
        const previousTotalValue = combinedPrevious?.[this.id];
        assertNotUndefined(combinedCurrent[this.typeicalPrice.id]);
        if (previousTotalValue == undefined || sameDay === false) {
            currentIndicator.values[this.id] = combinedCurrent[this.field] * combinedCurrent['volume'];
            return currentIndicator;
        }
        const currentTotalValue = truncateFloat(
            previousTotalValue + combinedCurrent[this.field] * combinedCurrent['volume'],
        );
        currentIndicator.values[this.id] = currentTotalValue;
        return currentIndicator;
    }
}
export class VWapIndicatorCalc extends AbstractIndicatorCalc {
    totalValue: TotalValueCalc;
    constructor() {
        super({ id: 'vwap', intervals: 1 });
        this.totalValue = new TotalValueCalc();
        this.addSubIndicator(this.totalValue);
    }

    calculateWithParams({ combinedCurrent, currentIndicator }: IndicatorCalcParams): Indicator {
        currentIndicator.values[this.id] = truncateFloat(
            combinedCurrent[this.totalValue.id] / combinedCurrent['totalVolume'],
        );
        return currentIndicator;
    }
}
