import { AbstractIndicatorCalc } from './base';

export class VWapIndicatorCalc extends AbstractIndicatorCalc {
    constructor() {
        super({ id: 'vwap()', intervals: 1 });
    }
}
