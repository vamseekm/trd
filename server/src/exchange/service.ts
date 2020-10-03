import { Mutex } from 'async-mutex';
import { timeStamp } from 'console';
import { DateTime } from 'luxon';

import { CacheGroup } from '../database/repository/cache-group';
import { Config } from '../infra';
import { IExchangeConfig } from '../types';
import { IExchangeTImeProperties } from '../types/exchange';
import { toDayAndTime } from '../util';

let _cachedExchangeTimes: Record<string, IExchangeConfig>;
const cacheLock = new Mutex();
const exchangeConfigCahce = new CacheGroup('exchange');
async function getAllExchangeTimes(): Promise<Record<string, IExchangeConfig>> {
    if (_cachedExchangeTimes != undefined) return _cachedExchangeTimes;
    const releaseLock = await cacheLock.acquire();
    try {
        if (_cachedExchangeTimes != undefined) return _cachedExchangeTimes;
        console.log('miss');
        const exchangeTimes: Record<string, IExchangeConfig> = {};
        const exchangeConfig = Config.get('EXCHANGE_CONFIG') as Record<string, IExchangeConfig>;
        const names: string[] = Object.keys(exchangeConfig);
        for (const name of names) {
            if (exchangeConfig[name]) {
                const { start, end } = exchangeConfig[name];
                const startDate = DateTime.fromObject({ year: 1970, month: 1, day: 1, ...start }).toJSDate();
                const endDate = DateTime.fromObject({ year: 1970, month: 1, day: 1, ...end }).toJSDate();
                const { time: startTime } = await toDayAndTime(startDate);
                const { time: endTime } = await toDayAndTime(endDate);
                exchangeTimes[name] = {
                    name,
                    startTime: Number.parseInt(startTime),
                    endTime: Number.parseInt(endTime),
                    start,
                    end,
                    dayStartOffset: startDate.getTime(),
                    dayEndOffset: endDate.getTime(),
                };
            }
        }
        _cachedExchangeTimes = exchangeTimes;
        return _cachedExchangeTimes;
    } finally {
        releaseLock();
    }
}
async function getExchangeTime(exchange: string): Promise<IExchangeConfig> {
    const exchangeConfig = (await getAllExchangeTimes())[exchange];
    if (!exchangeConfig) throw new Error(`Can't find config for exchange:${exchange}`);
    return exchangeConfig;
}

async function isValidTime({ date, exchange }: { date: Date; exchange: string }): Promise<boolean> {
    const exchangeConfig = (await getAllExchangeTimes())[exchange];
    if (exchangeConfig == undefined) return true;
    const { time } = await toDayAndTime(date);
    return Number.parseInt(time, 10) > exchangeConfig.startTime && Number.parseInt(time, 10) < exchangeConfig.endTime;
}

async function exchangeTimeProperties({
    timestamp,
    exchange,
}: {
    timestamp: Date;
    exchange: string;
}): Promise<IExchangeTImeProperties> {
    const exchangeConfig = (await getAllExchangeTimes())[exchange];
    if (exchangeConfig == undefined) throw new Error(`Didn't find exchange config for ${exchange}`);
    const { time } = await toDayAndTime(timestamp);
    return {
        valid:
            Number.parseInt(time, 10) > exchangeConfig.startTime && Number.parseInt(time, 10) < exchangeConfig.endTime,
        dayBegin: Number.parseInt(time) === exchangeConfig.startTime,
    };
}

export const ExchangeService = {
    getAllExchangeTimes,
    getExchangeTime,
    isValidTime,
    exchangeTimeProps: exchangeTimeProperties,
};
