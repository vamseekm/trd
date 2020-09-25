import { PrefModel } from '../model';

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
async function get(key: string, defaultValue?: string): Promise<string | undefined> {
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
