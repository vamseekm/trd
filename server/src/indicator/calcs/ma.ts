import { AbstractIndicatorCalc } from './base';
export interface MaInput {
    field: string;
    intervals: number;
}
export class SmaIndicatorCalc extends AbstractIndicatorCalc {
    constructor(opts: MaInput) {
        super({ id: `sma(${opts.field},${opts.intervals})` });
    }
}

export class EmaIndicatorCalc extends AbstractIndicatorCalc {
    smaIndicator: SmaIndicatorCalc;
    constructor(opts: MaInput) {
        super({ id: `ema(${opts.field},${opts.intervals})` });
        this.smaIndicator = new SmaIndicatorCalc(opts);
        this.addSubIndicator(this.smaIndicator);
    }
}
