import { Brackets, getRepository, In, Not } from 'typeorm';

import { UpsertResults } from '../types';
import { Candle } from './entity';
async function upsertCandles(inputCandleList: Candle[]): Promise<UpsertResults> {
    // const inputCandleKeySet: Set<string> = new Set();
    // const inputCandleMap: Map<string, Candle> = new Map();
    // for (const candle of inputCandleList) {
    //     inputCandleKeySet.add(candle.k);
    //     inputCandleMap.set(candle.k, candle);
    // }
    // const candleRepo = getRepository(Candle);
    // const databaseCandleList = await candleRepo.find({
    //     where: {
    //         k: In([...inputCandleKeySet]),
    //     },
    // });
    // const databaseCandleMap: Map<string, Candle> = new Map();
    // databaseCandleList.forEach((candle) => databaseCandleMap.set(candle.k, candle));
    // const updateCandleKeySet: Set<string> = new Set(databaseCandleList.map((candle) => candle.k));
    // const insertCandleKeySet: Set<string> = new Set([...inputCandleKeySet].filter((k) => !updateCandleKeySet.has(k)));
    // if (insertCandleKeySet.size > 0) {
    //     await candleRepo.insert([...insertCandleKeySet].map((k) => inputCandleMap.get(k) as Candle));
    // }
    // let updatedRows = 0;
    // if (updateCandleKeySet.size > 0) {
    //     const updateResults = await Promise.all(
    //         [...updateCandleKeySet].map((k) => {
    //             return candleRepo
    //                 .createQueryBuilder()
    //                 .update()
    //                 .where({ k })
    //                 .andWhere(
    //                     new Brackets((qb) =>
    //                         qb.where(
    //                             `o != :o OR h != :h OR l != :l OR c != :c OR v != :v OR tv != :tv OR oi != :oi OR toi != :toi`,
    //                             inputCandleMap.get(k) as Candle,
    //                         ),
    //                     ),
    //                 )
    //                 .set(inputCandleMap.get(k) as Candle)
    //                 .execute();
    //         }),
    //     );
    //     for (const updateResult of updateResults) {
    //         updatedRows += updateResult.affected || 0;
    //     }
    // }
    // console.log('All:', inputCandleKeySet.size);
    // console.log('Updates:', updatedRows);
    // console.log('Inserts:', insertCandleKeySet.size);
    // return { insert: insertCandleKeySet.size, update: updatedRows, remove: 0 };
    return { insert: 0, update: 0, remove: 0 };
}

export const CandleRepository = {
    storeCandles: upsertCandles,
};
