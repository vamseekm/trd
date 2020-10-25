import { DateTime } from 'luxon';

import { Config } from '../infra';
import { CandleInterval, IExchangeConfig, IExchangeTimeProperties } from '../types';
import { toDayAndTime } from '../util';

let _cachedExchangeTimes: Record<string, IExchangeConfig>;
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

function isValidTime({
    date,
    exchange,
    interval = CandleInterval.MIN_01,
}: {
    date: Date;
    exchange: string;
    interval?: CandleInterval;
}): boolean {
    const exchangeConfig = getAllExchangeTimes()[exchange];
    if (exchangeConfig == undefined) return true;
    const { dayTimeInMs, time } = toDayAndTime(date);
    return (
        (dayTimeInMs >= exchangeConfig.dayStartOffset && dayTimeInMs <= exchangeConfig.dayEndOffset) ||
        (interval === CandleInterval.DAY_01 && Number.parseInt(time) === 0)
    );
}

function exchangeTimeProperties({
    timestamp,
    exchange,
    interval,
}: {
    timestamp: Date;
    exchange: string;
    interval: CandleInterval;
}): IExchangeTimeProperties {
    const exchangeConfig = getAllExchangeTimes()[exchange];
    if (exchangeConfig == undefined) throw new Error(`Didn't find exchange config for ${exchange}`);
    const { time } = toDayAndTime(timestamp);
    const dayBegin =
        Number.parseInt(time, 10) === exchangeConfig.startTime ||
        (Number.parseInt(time, 10) === 0 && interval == CandleInterval.DAY_01);

    return {
        valid: isValidTime({ date: timestamp, exchange, interval }),
        dayBegin,
    };
}

export const ExchangeService = {
    getAllExchangeTimes,
    getExchangeTime,
    isValidTime,
    exchangeTimeProps: exchangeTimeProperties,
};
