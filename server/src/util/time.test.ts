import { timeCodeToDate, toDayAndTime } from './time';
test('hello', async () => {
    expect(!!toDayAndTime(new Date())).toEqual(true);
});

test.only('timeCodeToDate', () => {
    let runs = 0;
    for (let time = 1577817000000; time < Date.now(); time += 17 * 60 * 1000) {
        const inputDate = new Date(time);
        const inputParsed = toDayAndTime(inputDate);
        const outputDate = timeCodeToDate(inputParsed.timeCode);
        const outputParsed = toDayAndTime(outputDate);
        // console.log(inputParsed);
        // console.log(outputParsed);
        expect(inputParsed.timeCode).toEqual(outputParsed.timeCode);
        runs += 1;
        if (runs > 1000) break;
    }
});
