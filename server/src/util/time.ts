export async function sleep(time: number): Promise<any> {
    return new Promise((resolve) => {
        setTimeout(resolve, time);
    });
}

function padNumber(value: number, times = 2): string {
    return `${value}`.padStart(times, '0');
}

const UTC_OFFSET_IN_MS = 5 * 60 * 60 * 1000 + 30 * 60 * 1000;

export function toDayAndTime(date: Date): { day: string; time: string; timeCode: number; dayTimeInMs: number } {
    const adjustedTime = new Date(date.getTime() + UTC_OFFSET_IN_MS);
    const dayOfTheDate = new Date(date.getTime());
    dayOfTheDate.setUTCFullYear(1970);
    dayOfTheDate.setUTCMonth(0);
    dayOfTheDate.setUTCDate(1);

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
        dayTimeInMs: dayOfTheDate.getTime(),
    };
}

export function hoursInMs(hours: number): number {
    return hours * 3600 * 1000;
}

const timeCodeFormat = /^\d{10}$/g;
export function timeCodeToDate(timeCode: number | string): Date {
    if (typeof timeCode === 'number') timeCode = `${timeCode}`;
    if (!timeCode.match(timeCodeFormat))
        throw new Error(`Invalid format of timeCode: ${timeCode} len:${timeCode.length} type: ${typeof timeCode}`);
    const year = Number.parseInt(timeCode.slice(0, 2));
    const month = Number.parseInt(timeCode.slice(2, 4));
    const day = Number.parseInt(timeCode.slice(4, 6));
    const hour = Number.parseInt(timeCode.slice(6, 8));
    const minute = Number.parseInt(timeCode.slice(8, 10));
    const date = new Date(0);
    date.setUTCFullYear(2000 + year);
    date.setUTCMonth(month - 1);
    date.setUTCDate(day);
    date.setUTCHours(hour);
    date.setUTCMinutes(minute);
    return new Date(date.getTime() - UTC_OFFSET_IN_MS);
}
