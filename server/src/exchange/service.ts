import { ConsoleTransportOptions } from 'winston/lib/winston/transports';

import { Config } from '../infra';
import { IExchangeConfig } from '../types';
import { toDayAndTime } from '../util';

let _exchangeTimes: Map<string, IExchangeConfig>;
async function getExchangeTimes(): Promise<Map<string, IExchangeConfig>> {
    if (_exchangeTimes != undefined) return _exchangeTimes;
    _exchangeTimes = new Map<string, IExchangeConfig>();
    const exchangeConfig = Config.get('EXCHANGE_CONFIG') as Record<string, { startTime: number; endTime: number }>;
    const names: string[] = Object.keys(exchangeConfig);
    for (const name of names) {
        if (exchangeConfig[name]) {
            const { startTime, endTime } = exchangeConfig[name];
            _exchangeTimes.set(name, { name, startTime, endTime });
        }
    }
    return _exchangeTimes;
}

async function isValidTick({ date, exchange }: { date: Date; exchange: string }): Promise<boolean> {
    const exchangeConfig = (await getExchangeTimes()).get(exchange);
    if (exchangeConfig == undefined) return true;
    const { time } = await toDayAndTime(date);
    return time > exchangeConfig.startTime && time < exchangeConfig.endTime;
}

export const ExchangeService = {
    getExchangeTimes,
    isValidTick,
};
