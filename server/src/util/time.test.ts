import { toDayAndTime } from './time';
import { DateTime } from 'luxon';
import { performance } from 'perf_hooks';
test('hello', async () => {
    expect(toDayAndTime(new Date())).not.toEqual(null);
});
