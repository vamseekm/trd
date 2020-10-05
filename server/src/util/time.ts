import { DateTime } from 'luxon';

export async function sleep(time: number): Promise<any> {
    return new Promise((resolve) => {
        setTimeout(resolve, time);
    });
}

export async function toDayAndTime(date: Date): Promise<{ day: string; time: string; timeCode: number }> {
    const ldate = DateTime.fromJSDate(date).setZone('UTC+05:30');
    const day = ldate.toFormat('yyMMdd');
    const time = ldate.toFormat('HHmm');
    return {
        day,
        time,
        timeCode: Number.parseInt(`${day}${time}`, 10),
    };
}
