/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
/* eslint-disable no-useless-constructor */
import { Service } from 'typedi';
import config from 'config';

@Service()
export class Config {
    async get(key: string, defaultValue?: any): Promise<string> {
        if (config.has(key)) {
            return config.get(key);
        }
        return defaultValue || '';
    }
}
