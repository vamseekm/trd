import { PrefModel } from '../database';

async function get(key: string, defaultValue?: any): Promise<string> {
    const item = await PrefModel.findOne({ where: { key } });
    if (item?.value != undefined) return item.value;
    return defaultValue;
}

async function set(key: string, value: string): Promise<void> {
    await PrefModel.upsert({ key, value });
}

export const PrefRepository = {
    get,
    set,
};
