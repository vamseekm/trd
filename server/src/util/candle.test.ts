import { CandleInterval } from '../types/candle';
import { CandleUtil } from './candle';
test('makeCandleKey', async () => {
    expect(
        CandleUtil.makeCandleKey({ instrumentId: 'EX:INS', timeCode: '20125959', interval: CandleInterval.MIN_01 }),
    ).toMatchSnapshot();
    expect(
        CandleUtil.makeCandleKey({
            exchange: 'EX',
            tradingSymbol: 'INS',
            timeCode: '20125959',
            interval: CandleInterval.MIN_01,
        }),
    ).toMatchSnapshot();
    expect(
        CandleUtil.makeCandleKey({
            exchange: 'EX',
            tradingSymbol: 'INS',
            day: '2012',
            time: '5959',
            interval: CandleInterval.MIN_01,
        }),
    ).toMatchSnapshot();

    expect(() => {
        CandleUtil.makeCandleKey({ timeCode: '20125959', interval: CandleInterval.MIN_01 });
    }).toThrowError();

    expect(() => {
        CandleUtil.makeCandleKey({ instrumentId: 'EX:INS', interval: CandleInterval.MIN_01 });
    }).toThrowError();

    expect(true).toEqual(true);
});
