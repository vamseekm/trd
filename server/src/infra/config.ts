/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
import config from 'config';

export function configGet(key: string, defaultValue?: any): string {
    if (config.has(key)) {
        return config.get(key);
    }
    return defaultValue || '';
}
