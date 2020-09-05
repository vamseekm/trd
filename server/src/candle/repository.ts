import { diff as diffObject } from 'deep-diff';
import lodash from 'lodash';

import { UpsertResults } from '../types';
import { CandleClass, CandleModel } from './entity';
async function upsertCandles(inputCandleList: CandleClass[]): Promise<UpsertResults> {
    const inputCandleKeySet: Set<string> = new Set();
    const inputCandleMap: Map<string, CandleClass> = new Map();
    for (const candle of inputCandleList) {
        inputCandleKeySet.add(candle.k);
        inputCandleMap.set(candle.k, candle);
    }
    const databaseCandles = await CandleModel.find({
        k: { $in: [...inputCandleKeySet] },
    }).lean();

    const databaseCandleList = databaseCandles.map((candle) => {
        return lodash.pick(candle, ['k', 't', 'o', 'h', 'l', 'c', 'v', 'tv', 'oi', 'toi']);
    });
    const databaseCandleMap: Map<string, CandleClass> = new Map();
    databaseCandleList.forEach((candle) => databaseCandleMap.set(candle.k, candle));
    const updateCandleKeySet: Set<string> = new Set(databaseCandleList.map((candle) => candle.k));
    const insertCandleKeySet: Set<string> = new Set([...inputCandleKeySet].filter((k) => !updateCandleKeySet.has(k)));
    if (insertCandleKeySet.size > 0) {
        await CandleModel.insertMany([...insertCandleKeySet].map((k) => inputCandleMap.get(k) as CandleClass));
    }
    let updatedRows = 0;
    if (updateCandleKeySet.size > 0) {
        const updateResults = await Promise.all(
            [...updateCandleKeySet].map((k) => {
                if (diffObject(inputCandleMap.get(k), databaseCandleMap.get(k)))
                    return CandleModel.updateOne({ k }, inputCandleMap.get(k) as CandleClass);
            }),
        );
        updatedRows = updateResults.filter((i) => !!i).length;
    }
    return { insert: insertCandleKeySet.size, update: updatedRows, remove: 0 };
}

export const CandleRepository = {
    storeCandles: upsertCandles,
};
