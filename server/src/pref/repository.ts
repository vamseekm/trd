import { PrefModel } from './model';

async function get(key: string, defaultValue?: any): Promise<string> {
    const prefItem = await PrefModel.findOne({ key });
    if (prefItem?.value != undefined) return prefItem.value;
    return defaultValue;
}

async function set(key: string, value: string): Promise<void> {
    await PrefModel.findOneAndUpdate({ key }, { key, value });
}

export const PrefRepository = {
    get,
    set,
};
