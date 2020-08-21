import { redisDel, redisGet, redisSet } from '../../infra';

function configKey(key: string): string {
    return `pref:${key}`;
}

async function get(key: string): Promise<string> {
    return redisGet([configKey(key)]);
}

async function set(key: string, value: string): Promise<void> {
    await redisSet([configKey(key), value, 'PX', 12 * 3600]);
}

async function remove(key: string): Promise<void> {
    return redisDel([configKey(key)]);
}

export const PrefMemoryRepository = {
    configKey,
    get,
    set,
    remove,
};
