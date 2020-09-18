import { diff as diffObject } from 'deep-diff';
import lodash from 'lodash';

import { CandleModel } from '../database';
import { Candle, UpsertResults } from '../types';
import { toSetAndMap } from '../util';

async function upsertCandles(inputCandleList: Candle[]): Promise<UpsertResults> {
    const upsertResults: UpsertResults = { insert: 0, update: 0, remove: 0 };

    const input = toSetAndMap(inputCandleList, 'key');
    const database = toSetAndMap(
        await CandleModel.findAll({ where: { key: { $in: [...input.set] } }, attributes: ['key'] }),
        'key',
    );

    const updateCandleKeySet: Set<string> = new Set(database.set);
    const updateResults = await Promise.all(
        [...updateCandleKeySet].map((key) => {
            const diff = diffObject(
                input.map.get(key),
                lodash.omit(database.map.get(key), ['createdAt', 'updatedAt', '_id', '__v']),
            );
            if (diff) {
                return CandleModel.update(input.map.get(key) as Candle, { where: { key } });
            }
        }),
    );
    upsertResults.update = updateResults.filter((i) => !!i).length;

    const insertCandleKeySet: Set<string> = new Set([...input.set].filter((key) => !updateCandleKeySet.has(key)));
    if (insertCandleKeySet.size === 0) return upsertResults;
    await CandleModel.bulkCreate([...insertCandleKeySet].map((key) => input.map.get(key) as Candle));
    upsertResults.insert = insertCandleKeySet.size;
    return upsertResults;
}

export const CandleRepository = {
    storeCandles: upsertCandles,
};
