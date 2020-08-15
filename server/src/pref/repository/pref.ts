import { Service } from 'typedi';

import { Redis } from '../../infra';
import { PrefDBRepostiory } from './database';
import { PrefMemoryRepository } from './memory';

@Service()
export class PrefRepository {
    constructor(private prefDatabaseRepo: PrefDBRepostiory, private prefMemoryRepo: PrefMemoryRepository) {}

    async get(key: string, defaultValue?: any): Promise<string> {
        const payload = await this.prefMemoryRepo.get(key);
        if (payload != undefined) {
            const { value } = JSON.parse(payload);
            return value;
        }
        const prefItem = await this.prefDatabaseRepo.findBy({ key });
        if (prefItem != undefined) {
            await this.prefMemoryRepo.set(prefItem.key, prefItem.value);
            const { value } = JSON.parse(prefItem.value);
            return value;
        }
        return defaultValue;
    }

    async set(key: string, value: string): Promise<void> {
        await this.prefDatabaseRepo.upsert({ key, value: JSON.stringify({ value }) });
        await this.prefMemoryRepo.remove(key);
        //Force caching.
        await this.get(key);
    }
}
