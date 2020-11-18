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
        assertNotUndefined('high', high);
        assertNotUndefined('low', low);
        assertNotUndefined('close', low);
        currentIndicator.values[this.id] = truncateFloat((high + low + close) / 3);
        return currentIndicator;
    }
}
export class TotalValueCalc extends AbstractIndicatorCalc {
    tp: TypicalPriceCalc = new TypicalPriceCalc();
    constructor() {
        super({ id: `totalValue`, intervals: 1, field: 'typicalPrice' });
        this.addSubIndicator(this.tp);
    }

    calculateWithParams({
        currentIndicator,
        combinedPrevious,
        combinedCurrent,
        sameDay,
    }: IndicatorCalcParams): Indicator {
        const previousTotalValue = combinedPrevious?.[this.id];
        assertNotUndefined('typeicalPrice', combinedCurrent[this.tp.id]);
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
    tv: TotalValueCalc;
    constructor() {
        super({ id: 'vwap', intervals: 1 });
        this.tv = new TotalValueCalc();
        this.addSubIndicator(this.tv);
    }

    calculateWithParams({ combinedCurrent, currentIndicator }: IndicatorCalcParams): Indicator {
        currentIndicator.values[this.id] = truncateFloat(combinedCurrent[this.tv.id] / combinedCurrent['totalVolume']);
        return currentIndicator;
    }
}
