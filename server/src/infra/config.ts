/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
import configLib from 'config';

export function get(key: string, defaultValue?: any): string {
    if (configLib.has(key)) {
        return configLib.get(key);
    }
    return defaultValue || '';
}
export const Config = {
    get,
};
