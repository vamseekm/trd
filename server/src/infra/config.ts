/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
import configLib from 'config';

import { IExchangeConfig } from '../types';

function get(key: string, defaultValue?: any): any {
    if (configLib.has(key)) {
        return configLib.get(key);
    }
    if (defaultValue != undefined) return defaultValue;
    throw new Error(`Can't find config ${key}`);
}
// let _exchangeTimes: Map<string, IExchangeConfig>;
// function getExchangeTimes() {
//     if (_exchangeTimes != undefined) return _exchangeTimes;
//     _exchangeTimes = new Map<string, IExchangeConfig>();
//     _exchangeTimes.set('NSE', { name: 'NSE', startTime: 915, endTime: 1530 });
//     _exchangeTimes.set('NFO', { name: 'NFO', startTime: 915, endTime: 1530 });
//     return _exchangeTimes;
// }

export const Config = {
    get,
    // getExchangeTimes,
};
