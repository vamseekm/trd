import { Indicator } from '../../types';
import { truncateFloat } from '../../util/nums/nums';
import { AbstractIndicatorCalc, IndicatorCalcParams } from './base';
export interface MaInput {
    field: string;
    intervals: number;
    id?: string;
}

export class SmaIndicatorCalc extends AbstractIndicatorCalc {
    constructor(opts: MaInput) {
        super({ id: `sma(${opts.field},${opts.intervals})`, ...opts });
    }

    calculateWithParams({
        combinedPrevious,
        combinedCurrent,
        currentIndicator,
        sameDay,
    }: IndicatorCalcParams): Indicator {
        const prevSma = (combinedPrevious as any)[this.id];
        const currentValue = (combinedCurrent as any)[this.field];
        if (prevSma == undefined || sameDay === false) {
            currentIndicator.values[this.id] = currentValue;
            return currentIndicator;
        }

        const currentSma = prevSma * ((this.intervals - 1) / this.intervals) + currentValue / this.intervals;
        currentIndicator.values[this.id] = truncateFloat(currentSma);
        return currentIndicator;
    }
}

export class EmaIndicatorCalc extends AbstractIndicatorCalc {
    constructor(opts: MaInput) {
        super({ id: `ema(${opts.field},${opts.intervals})`, ...opts });
    }

    calculateWithParams({
        combinedCurrent,
        combinedPrevious,
        currentIndicator,
        sameDay,
    }: IndicatorCalcParams): Indicator {
        const prevEma = (combinedPrevious as any)?.[this.id];
        const currentValue = (combinedCurrent as any)[this.field];
        if (prevEma == undefined || sameDay === false) {
            currentIndicator.values[this.id] = currentValue;
            return currentIndicator;
        }
        const k = 2 / (this.intervals + 1);
        const currentEma = currentValue * k + prevEma * (1 - k);
        currentIndicator.values[this.id] = truncateFloat(currentEma);
        return currentIndicator;
    }
}
