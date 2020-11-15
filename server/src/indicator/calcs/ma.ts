import { Indicator } from '../../types';
import { assertNotUndefined } from '../../util/lib/algo-ds';
import { AbstractIndicatorCalc, IndicatorCalcParams } from './base';
export interface MaInput {
    field: string;
    intervals: number;
}

export class SmaIndicatorCalc extends AbstractIndicatorCalc {
    constructor(opts: MaInput) {
        super({ ...opts, id: `sma(${opts.field},${opts.intervals})` });
    }

    calculateWithParams({ combinedPrevious, combinedCurrent, currentIndicator }: IndicatorCalcParams): Indicator {
        const prevSma = (combinedPrevious as any)[this.id];
        const currentValue = (combinedCurrent as any)[this.field];
        assertNotUndefined('this.field', currentValue);
        if (prevSma == undefined) {
            currentIndicator.values[this.id] = currentValue;
            return currentIndicator;
        }

        const currentSma = prevSma * ((this.intervals - 1) / this.intervals) + currentValue / this.intervals;
        currentIndicator.values[this.id] = Number.parseFloat(currentSma.toFixed(4));
        return currentIndicator;
    }
}

export class EmaIndicatorCalc extends AbstractIndicatorCalc {
    smaIndicator: SmaIndicatorCalc;
    constructor(opts: MaInput) {
        super({ ...opts, id: `ema(${opts.field},${opts.intervals})` });
        this.smaIndicator = new SmaIndicatorCalc(opts);
        this.addSubIndicator(this.smaIndicator);
    }

    calculateWithParams({ currentIndicator, previousIndicator, currentCandle }: IndicatorCalcParams): Indicator {
        const prevEma = previousIndicator?.values[this.id];
        const currentValue = (currentCandle as any)[this.field];
        if (prevEma == undefined) {
            currentIndicator.values[this.id] = currentValue;
            return currentIndicator;
        }
        const k = 2 / (this.intervals + 1);
        const currentEma = currentValue * k + prevEma * (1 - k);
        currentIndicator.values[this.id] = currentEma;
        return currentIndicator;
    }
}
