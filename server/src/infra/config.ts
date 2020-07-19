/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
/* eslint-disable no-useless-constructor */
import config from 'config';
import { Service } from 'typedi';

@Service()
export class Config {
    get(key: string, defaultValue?: any): string {
        if (config.has(key)) {
            return config.get(key);
        }
        return defaultValue || '';
    }
}
