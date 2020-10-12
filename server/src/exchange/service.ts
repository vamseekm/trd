import { Mutex } from 'async-mutex';
import { timeStamp } from 'console';
import { DateTime } from 'luxon';

import { CacheGroup } from '../database/repository/cache-group';
import { Config } from '../infra';
import { IExchangeConfig } from '../types';
import { IExchangeTImeProperties } from '../types/exchange';
import { toDayAndTime } from '../util';
import sp from 'synchronized-promise';
import { MissingSubscriptionTopicsError } from 'type-graphql';

let _cachedExchangeTimes: Record<string, IExchangeConfig>;
const cacheLock = new Mutex();
const exchangeConfigCahce = new CacheGroup('exchange');
let missCount = 0;
function getAllExchangeTimes(): Record<string, IExchangeConfig> {
    if (_cachedExchangeTimes != undefined) return _cachedExchangeTimes;
    missCount += 1;
    if (missCount > 1) {
        throw new Error(`getAllExchageTimes missed cache more than ${missCount}`);
    }
    const exchangeTimes: Record<string, IExchangeConfig> = {};
    const exchangeConfig = Config.get('EXCHANGE_CONFIG') as Record<string, IExchangeConfig>;
    const names: string[] = Object.keys(exchangeConfig);
    for (const name of names) {
        if (exchangeConfig[name]) {
            const { start, end } = exchangeConfig[name];
            const startDate = DateTime.fromObject({ year: 1970, month: 1, day: 1, ...start }).toJSDate();
            const endDate = DateTime.fromObject({ year: 1970, month: 1, day: 1, ...end }).toJSDate();
            const { time: startTime } = toDayAndTime(startDate);
            const { time: endTime } = toDayAndTime(endDate);
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
    return (_cachedExchangeTimes = exchangeTimes);
}
function getExchangeTime(exchange: string): IExchangeConfig {
    const exchangeConfig = getAllExchangeTimes()[exchange];
    if (!exchangeConfig) throw new Error(`Can't find config for exchange:${exchange}`);
    return exchangeConfig;
}

function isValidTime({ date, exchange }: { date: Date; exchange: string }): boolean {
    const exchangeConfig = getAllExchangeTimes()[exchange];
    if (exchangeConfig == undefined) return true;
    const { time } = toDayAndTime(date);
    return Number.parseInt(time, 10) > exchangeConfig.startTime && Number.parseInt(time, 10) < exchangeConfig.endTime;
}

function exchangeTimeProperties({
    timestamp,
    exchange,
}: {
    timestamp: Date;
    exchange: string;
}): IExchangeTImeProperties {
    const exchangeConfig = getAllExchangeTimes()[exchange];
    if (exchangeConfig == undefined) throw new Error(`Didn't find exchange config for ${exchange}`);
    const { time } = toDayAndTime(timestamp);
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
