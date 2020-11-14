import { flattenIndicatorDependency } from './calcs/lib';
import { MacdIndicatorCalc } from './calcs/macd';
import { VWapIndicatorCalc } from './calcs/vwap';

test('Indicator flatten test', async () => {
    expect(true).toEqual(true);
    const macd = new MacdIndicatorCalc({ field: 'close', emaPeriodShort: 12, emaPeriodLong: 26, signalPeriod: 9 });
    const indicators = flattenIndicatorDependency([macd, new VWapIndicatorCalc()]);
    const ids = indicators.map((indicator) => indicator.id);
    expect(ids).toMatchSnapshot();
});
