import { AbstractIndicatorCalc } from './base';
import { EmaIndicatorCalc } from './ma';

export interface MacdInputOptions {
    emaPeriodShort: number;
    emaPeriodLong: number;
    signalPeriod: number;
    field: string;
}

export class MacdLineCacl extends AbstractIndicatorCalc {
    longEma: EmaIndicatorCalc;
    shortEma: EmaIndicatorCalc;
    constructor(opts: MacdInputOptions) {
        super({ id: `macdLine(${opts.field},${opts.emaPeriodShort},${opts.emaPeriodLong})` });
        this.longEma = new EmaIndicatorCalc({ intervals: opts.emaPeriodLong, field: opts.field });
        this.shortEma = new EmaIndicatorCalc({ intervals: opts.emaPeriodShort, field: opts.field });
        this.addSubIndicator(this.longEma);
        this.addSubIndicator(this.shortEma);
    }
}

export class MacdSignalLineCalc extends AbstractIndicatorCalc {
    macdLine: MacdLineCacl;
    signalLine: EmaIndicatorCalc;
    constructor(opts: MacdInputOptions) {
        super({
            id: `macdSignal(${opts.field},${opts.emaPeriodShort},${opts.emaPeriodLong},${opts.signalPeriod})`,
        });
        this.macdLine = new MacdLineCacl(opts);
        this.addSubIndicator(this.macdLine);
        this.signalLine = new EmaIndicatorCalc({ field: this.macdLine.id, intervals: opts.signalPeriod });
        this.addSubIndicator(this.signalLine);
    }
}

export class MacdHistogramCalc extends AbstractIndicatorCalc {
    longEma: EmaIndicatorCalc;
    shortEma: EmaIndicatorCalc;
    constructor(opts: MacdInputOptions) {
        super({ id: `macdHisto(${opts.field},${opts.emaPeriodShort},${opts.emaPeriodLong})` });
        this.longEma = new EmaIndicatorCalc({ intervals: opts.emaPeriodLong, field: opts.field });
        this.shortEma = new EmaIndicatorCalc({ intervals: opts.emaPeriodShort, field: opts.field });
        this.addSubIndicator(this.longEma);
        this.addSubIndicator(this.shortEma);
    }
}

export class MacdIndicatorCalc extends AbstractIndicatorCalc {
    macdLine: MacdLineCacl;
    signalLine: MacdSignalLineCalc;
    histogram: MacdHistogramCalc;
    constructor(opts: MacdInputOptions) {
        super({ id: `macd(${opts.field},${opts.emaPeriodShort},${opts.emaPeriodLong},${opts.signalPeriod})` });
        this.macdLine = new MacdLineCacl(opts);
        this.signalLine = new MacdSignalLineCalc(opts);
        this.histogram = new MacdHistogramCalc(opts);
        this.addSubIndicator(this.macdLine);
        this.addSubIndicator(this.signalLine);
        this.addSubIndicator(this.histogram);
    }
}
export function defaultMacdIndicator(): AbstractIndicatorCalc {
    return new MacdIndicatorCalc({ emaPeriodShort: 12, emaPeriodLong: 26, signalPeriod: 9, field: 'close' });
}
