import { delay } from 'bluebird';
import { DateTime } from 'luxon';

import { Config } from '../infra';
import { IExchangeConfig } from '../types';
import { toDayAndTime } from '../util';

let _exchangeTimes: Map<string, IExchangeConfig>;
let lock = false;
async function getAllExchangeTimes(): Promise<Map<string, IExchangeConfig>> {
    if (_exchangeTimes != undefined) return _exchangeTimes;
    while (lock === true) await delay(0);
    lock = true;

    const exchangeTimes = new Map<string, IExchangeConfig>();
    const exchangeConfig = Config.get('EXCHANGE_CONFIG') as Record<
        string,
        {
            startTime: number;
            endTime: number;
            start: { hour: number; minute: number };
            end: { hour: number; minute: number };
        }
    >;
    const names: string[] = Object.keys(exchangeConfig);
    for (const name of names) {
        if (exchangeConfig[name]) {
            const { start, end } = exchangeConfig[name];
            const startDate = DateTime.fromObject({ year: 1970, month: 1, day: 1, ...start }).toJSDate();
            const endDate = DateTime.fromObject({ year: 1970, month: 1, day: 1, ...end }).toJSDate();
            const { time: startTime } = await toDayAndTime(startDate);
            const { time: endTime } = await toDayAndTime(endDate);
            exchangeTimes.set(name, {
                name,
                startTime: Number.parseInt(startTime),
                endTime: Number.parseInt(endTime),
                start,
                end,
                dayStartOffset: startDate.getTime(),
                dayEndOffset: endDate.getTime(),
            });
        }
    }
    _exchangeTimes = exchangeTimes;
    lock = false;
    return _exchangeTimes;
}

async function getExchangeTime(exchange: string): Promise<IExchangeConfig> {
    const exchangeConfig = (await getAllExchangeTimes()).get(exchange);
    if (!exchangeConfig) throw new Error("Can't find config for exchange:${exchange}");
    return exchangeConfig;
}

async function isValidTime({ date, exchange }: { date: Date; exchange: string }): Promise<boolean> {
    const exchangeConfig = (await getAllExchangeTimes()).get(exchange);
    if (exchangeConfig == undefined) return true;
    const { time } = await toDayAndTime(date);
    return Number.parseInt(time, 10) > exchangeConfig.startTime && Number.parseInt(time, 10) < exchangeConfig.endTime;
}

export const ExchangeService = {
    getAllExchangeTimes,
    getExchangeTime,
    isValidTime,
};
