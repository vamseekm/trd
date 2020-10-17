import { toDayAndTime } from './time';
test('hello', async () => {
    expect(!!toDayAndTime(new Date())).toEqual(true);
});
