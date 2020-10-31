import { RedisService } from '../../infrastructure';
interface ISortedSetItem {
    key: string;
    score: string;
    value: string;
}

async function writeItems({ items, update = false }: { items: ISortedSetItem[]; update?: boolean }): Promise<any> {
    const groups: Record<string, string[]> = {};
    const keys = new Set<string>();
    for (const item of items) {
        groups[item.key] = groups[item.key] || (update === false ? [item.key, 'NX'] : [item.key]);
        groups[item.key].push(item.score, item.value);
        keys.add(item.key);
    }
    await Promise.all(
        [...keys].map((key) => {
            return RedisService.zadd(groups[key]);
        }),
    );
    return 1;
}

export const SortedSet = {
    writeItems,
};
