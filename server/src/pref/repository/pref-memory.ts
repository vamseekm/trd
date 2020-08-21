import { Redis } from '../../infra';

function configKey(key: string): string {
    return `pref:${key}`;
}

async function get(key: string): Promise<string> {
    return Redis.get([configKey(key)]);
}

async function set(key: string, value: string): Promise<void> {
    await Redis.set([configKey(key), value, 'PX', 12 * 3600]);
}

async function remove(key: string): Promise<void> {
    return Redis.del([configKey(key)]);
}

export const PrefMemoryRepository = {
    configKey,
    get,
    set,
    remove,
};
