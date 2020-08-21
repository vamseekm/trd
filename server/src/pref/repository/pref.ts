import { Service } from 'typedi';

import { PrefDBRepostiory } from './pref-database';
import { PrefMemoryRepository } from './pref-memory';

async function get(key: string, defaultValue?: any): Promise<string> {
    const payload = await PrefMemoryRepository.get(key);
    if (payload != undefined) {
        const { value } = JSON.parse(payload);
        return value;
    }
    const prefItem = await PrefDBRepostiory.findBy({ key });
    if (prefItem != undefined) {
        await PrefMemoryRepository.set(prefItem.key, prefItem.value);
        const { value } = JSON.parse(prefItem.value);
        return value;
    }
    return defaultValue;
}

async function set(key: string, value: string): Promise<void> {
    await PrefDBRepostiory.upsert({ key, value: JSON.stringify({ value }) });
    await PrefMemoryRepository.remove(key);
    //Force caching.
    await get(key);
}

export const PrefRepository = {
    get,
    set,
};
