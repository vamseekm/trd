/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
/* eslint-disable no-useless-constructor */
import { Service } from 'typedi';
import config from 'config';

@Service()
export class Config {
    get(key: string, defaultValue?: any): string {
        if (config.has(key)) {
            return config.get(key);
        }
        return defaultValue || '';
    }
}
