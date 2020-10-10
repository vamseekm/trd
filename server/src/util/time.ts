import { DateTime } from 'luxon';

export async function sleep(time: number): Promise<any> {
    return new Promise((resolve) => {
        setTimeout(resolve, time);
    });
}

export async function xtoDayAndTime(date: Date): Promise<{ day: string; time: string; timeCode: number }> {
    const ldate = DateTime.fromJSDate(date).setZone('UTC+05:30');
    const day = ldate.toFormat('yyMMdd');
    const time = ldate.toFormat('HHmm');
    return {
        day,
        time,
        timeCode: Number.parseInt(`${day}${time}`, 10),
    };
}
function padNumber(num: number, times: number = 2): string {
    return `${num}`.padStart(times, '0');
}
export function toDayAndTime(date: Date): { day: string; time: string; timeCode: number } {
    const adjustedTime = new Date(date.getTime() + 5 * 60 * 60 * 1000 + 30 * 60 * 1000);
    const day = padNumber(
        ((adjustedTime.getUTCFullYear() % 100) * 100 + (adjustedTime.getUTCMonth() + 1)) * 100 +
            adjustedTime.getUTCDate(),
        6,
    );
    const time = padNumber(adjustedTime.getUTCHours() * 100 + adjustedTime.getUTCMinutes(), 4);
    return {
        day,
        time,
        timeCode: Number.parseInt(`${day}${time}`, 10),
    };
}
