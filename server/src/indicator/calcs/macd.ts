import { IndicatorCalcParams } from '../../../dist/indicator/calcs/base';
import { Indicator } from '../../types';
import { assertNotUndefined } from '../../util/lib/algo-ds';
import { truncateFloat } from '../../util/nums/nums';
import { AbstractIndicatorCalc } from './base';
import { EmaIndicatorCalc } from './ma';

export interface MacdInputOptions {
    emaPeriodShort: number;
    emaPeriodLong: number;
    signalPeriod: number;
    field: string;
    intervals: number;
    id?: string;
}

export class MacdLineCacl extends AbstractIndicatorCalc {
    longEma: EmaIndicatorCalc;
    shortEma: EmaIndicatorCalc;
    constructor(opts: MacdInputOptions) {
        super({
            id: `macdLine(${opts.field},${opts.emaPeriodShort},${opts.emaPeriodLong},${opts.signalPeriod})`,
            ...opts,
        });
        this.longEma = new EmaIndicatorCalc({ intervals: opts.emaPeriodLong, field: opts.field });
        this.shortEma = new EmaIndicatorCalc({ intervals: opts.emaPeriodShort, field: opts.field });
        this.addSubIndicator(this.longEma);
        this.addSubIndicator(this.shortEma);
    }

    calculateWithParams({ combinedCurrent, currentIndicator }: IndicatorCalcParams): Indicator {
        const longEmaVal = combinedCurrent[this.longEma.id];
        assertNotUndefined(this.longEma);
        const shortEmaVal = combinedCurrent[this.shortEma.id];
        assertNotUndefined(this.shortEma);
        currentIndicator.values[this.id] = truncateFloat(shortEmaVal - longEmaVal);
        return currentIndicator;
    }
}

export class MacdBaseIndicatorCalcPreReq extends AbstractIndicatorCalc {
    macdLine: MacdLineCacl;
    signalLine: EmaIndicatorCalc;
    constructor(opts: MacdInputOptions) {
        super({
            ...opts,
            id: `macdBase(${opts.field},${opts.emaPeriodShort},${opts.emaPeriodLong},${opts.signalPeriod})`,
        });
        this.macdLine = new MacdLineCacl(opts);
        this.signalLine = new EmaIndicatorCalc({
            ...opts,
            field: this.macdLine.id,
            id: `macdSignal(${opts.field},${opts.emaPeriodShort},${opts.emaPeriodLong},${opts.signalPeriod})`,
        });
        this.addSubIndicator(this.macdLine);
        this.addSubIndicator(this.signalLine);
    }

    calculateWithParams({ currentIndicator }: IndicatorCalcParams): Indicator {
        return currentIndicator;
    }
}

export class MacdHistogramCalc extends AbstractIndicatorCalc {
    macdPreReq: MacdBaseIndicatorCalcPreReq;
    constructor(opts: MacdInputOptions) {
        super({ ...opts, id: `macdHisto(${opts.field},${opts.emaPeriodShort},${opts.emaPeriodLong})` });
        this.macdPreReq = new MacdBaseIndicatorCalcPreReq(opts);
        this.addSubIndicator(this.macdPreReq);
    }
    calculateWithParams({ currentIndicator, combinedCurrent }: IndicatorCalcParams): Indicator {
        const macdLineVal = combinedCurrent[this.macdPreReq.macdLine.id];
        assertNotUndefined(macdLineVal);
        const signalLineVal = combinedCurrent[this.macdPreReq.signalLine.id];
        assertNotUndefined(signalLineVal);
        currentIndicator.values[this.id] = macdLineVal - signalLineVal;
        return currentIndicator;
    }
}

export class MacdIndicatorCalc extends AbstractIndicatorCalc {
    macdHisto: MacdHistogramCalc;
    constructor(opts: MacdInputOptions) {
        super({
            ...opts,
            id: `macd(${opts.field},${opts.emaPeriodShort},${opts.emaPeriodLong},${opts.signalPeriod})`,
        });
        this.macdHisto = new MacdHistogramCalc(opts);
        this.addSubIndicator(this.macdHisto);
    }
    calculateWithParams({ currentIndicator }: IndicatorCalcParams): Indicator {
        return currentIndicator;
    }
}

export function defaultMacdIndicator(): AbstractIndicatorCalc {
    return new MacdIndicatorCalc({
        emaPeriodShort: 12,
        emaPeriodLong: 26,
        signalPeriod: 9,
        field: 'close',
        intervals: 1,
    });
}
