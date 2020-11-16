import { flattenIndicatorDependency } from './calcs/lib';
import { MacdIndicatorCalc } from './calcs/macd';
import { VWapIndicatorCalc } from './calcs/vwap';

test('Indicator dependency flatten', async () => {
    const macd = new MacdIndicatorCalc({
        field: 'close',
        emaPeriodShort: 12,
        emaPeriodLong: 26,
        signalPeriod: 9,
        intervals: 1,
    });
    const indicators = flattenIndicatorDependency([macd, new VWapIndicatorCalc()]);
    const ids = indicators.map((indicator) => indicator.id);
    expect(ids).toMatchSnapshot();
});

// beforeEach(() => {
//     // eslint-disable-next-line @typescript-eslint/no-var-requires
//     const candleData: { timeCode: number; close: number }[] = require('./__mocks__/candles.json');
//     const exchange = 'NSE';
//     const tradingSymbol = 'DUMMY';
//     const instrumentId = `${exchange}${InstrumentConsts.ID_SEPERATOR}${tradingSymbol}`;
//     const interval = CandleInterval.MIN_01;
//     const candles = candleData.map(
//         (candle): Candle => {
//             const { timeCode, close } = candle;
//             return {
//                 exchange,
//                 instrumentId,
//                 timeCode,
//                 close,
//             };
//         },
//     );
//     // console.log(candles);
// });

test('SMA', async () => {
    expect(true).toEqual(true);
});
