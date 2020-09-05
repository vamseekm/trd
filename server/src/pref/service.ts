import { PrefRepository } from './repository';

async function get(key: string, defaultValue?: string): Promise<string> {
    return PrefRepository.get(key, defaultValue);
}

async function set(key: string, value: string): Promise<void> {
    return PrefRepository.set(key, value);
}

export const PrefService = {
    get,
    set,
};
