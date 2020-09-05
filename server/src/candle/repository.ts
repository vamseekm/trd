import { diff as diffObject } from 'deep-diff';
import lodash from 'lodash';

import { UpsertResults } from '../types';
import { toSetAndMap } from '../util';
import { Candle, CandleModel } from './model';

async function upsertCandles(inputCandleList: Candle[]): Promise<UpsertResults> {
    const upsertResults: UpsertResults = { insert: 0, update: 0, remove: 0 };

    const input = toSetAndMap(inputCandleList, 'k');
    const database = toSetAndMap(await CandleModel.find({ k: { $in: [...input.set] } }).lean(), 'k');

    const updateCandleKeySet: Set<string> = new Set(database.set);
    const updateResults = await Promise.all(
        [...updateCandleKeySet].map((k) => {
            const diff = diffObject(
                input.map.get(k),
                lodash.omit(database.map.get(k), ['createdAt', 'updatedAt', '_id', '__v']),
            );
            if (diff) {
                return CandleModel.updateOne({ k }, input.map.get(k) as Candle);
            }
        }),
    );
    upsertResults.update = updateResults.filter((i) => !!i).length;

    const insertCandleKeySet: Set<string> = new Set([...input.set].filter((k) => !updateCandleKeySet.has(k)));
    if (insertCandleKeySet.size === 0) return upsertResults;
    await CandleModel.insertMany([...insertCandleKeySet].map((k) => input.map.get(k) as Candle));
    upsertResults.insert = insertCandleKeySet.size;
    return upsertResults;
}

export const CandleRepository = {
    storeCandles: upsertCandles,
};
