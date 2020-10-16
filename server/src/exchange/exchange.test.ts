import { ExchangeService } from './service';
import { DateTime } from 'luxon';

test('checkLimits', async () => {
    expect(
        ExchangeService.isValidTime({
            date: DateTime.local().set({ hour: 9, minute: 14, second: 59 }).toJSDate(),
            exchange: 'NSE',
        }),
    ).toEqual(false);

    expect(
        ExchangeService.isValidTime({
            date: DateTime.local().set({ hour: 9, minute: 15, second: 0 }).toJSDate(),
            exchange: 'NSE',
        }),
    ).toEqual(true);
    expect(
        ExchangeService.isValidTime({
            date: DateTime.local().set({ hour: 11, minute: 30, second: 0 }).toJSDate(),
            exchange: 'NSE',
        }),
    ).toEqual(true);

    expect(
        ExchangeService.isValidTime({
            date: DateTime.local().set({ hour: 15, minute: 29, second: 59 }).toJSDate(),
            exchange: 'NSE',
        }),
    ).toEqual(true);
    expect(
        ExchangeService.isValidTime({
            date: DateTime.local().set({ hour: 15, minute: 30, second: 0 }).toJSDate(),
            exchange: 'NSE',
        }),
    ).toEqual(false);
});
