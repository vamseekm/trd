import { Indicator } from '../../types';
import { AbstractIndicatorCalc, IndicatorCalcParams } from './base';
export interface MaInput {
    field: string;
    intervals: number;
}

export class SmaIndicatorCalc extends AbstractIndicatorCalc {
    constructor(opts: MaInput) {
        super({ ...opts, id: `sma(${opts.field},${opts.intervals})` });
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
        currentIndicator.values[this.id] = Number.parseFloat(currentEma.toFixed(4));
        return currentIndicator;
    }
}
