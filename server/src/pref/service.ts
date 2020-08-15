/* eslint-disable no-useless-constructor */
import { Service } from 'typedi';

import { Redis } from '../infra';
import { PrefRepository } from './repository/pref';

@Service()
export class PrefService {
    constructor(private redis: Redis, private prefRepo: PrefRepository) {}

    async get(key: string, defaultValue?: string): Promise<string> {
        return this.prefRepo.get(key, defaultValue);
    }

    async set(key: string, value: string): Promise<void> {
        return this.prefRepo.set(key, value);
    }
}
