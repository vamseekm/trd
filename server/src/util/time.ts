export async function sleep(time: number): Promise<any> {
    return new Promise((resolve) => {
        setTimeout(resolve, time);
    });
}

function padNumber(value: number, times = 2): string {
    return `${value}`.padStart(times, '0');
}

export function toDayAndTime(date: Date): { day: string; time: string; timeCode: number; dayTimeInMs: number } {
    const adjustedTime = new Date(date.getTime() + 5 * 60 * 60 * 1000 + 30 * 60 * 1000);

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
