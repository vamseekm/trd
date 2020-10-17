import { Op, Sequelize, WhereOptions } from 'sequelize';

import { Log } from '../../infra';
import { Candle, CandleInterval } from '../../types';
import { validateCandle } from '../../types/candle';
import { CandleModel } from '../model';

async function upsertCandles(inputCandleList: Candle[]): Promise<any> {
    return await CandleModel.bulkCreate(inputCandleList, {
        updateOnDuplicate: [
            'open',
            'high',
            'low',
            'close',
            'volume',
            'openInterest',
            'totalVolume',
            'totalOpenInterest',
        ],
        returning: false,
    });
}

async function getCandle(key: string): Promise<Candle | null> {
    return CandleModel.findOne({ where: { key }, raw: true });
}

async function findBy({
    id,
    interval,
    from,
    to,
}: {
    id: string;
    interval?: CandleInterval;
    from?: Date;
    to?: Date;
}): Promise<Candle[]> {
    // const keyTokens: string[] = [id, interval || '%'];
    // const keyPrefix = `${keyTokens.join(INSTRUMENT_ID_SEPERATOR)}:%`;
    const prefix = [id, interval].filter((token) => token != undefined).join(':');
    const keyPrefix = `${prefix}:%`;
    let where: WhereOptions = { key: { [Op.like]: keyPrefix } };
    if (from && to) where = { ...where, timestamp: { [Op.gte]: from, [Op.lte]: to } };
    return validate(await CandleModel.findAll({ where, order: Sequelize.col('key'), raw: true }));
}

async function validate(inputCandles: Candle[]): Promise<Candle[]> {
    try {
        return await Promise.all(
            inputCandles.map((inputCandle) => {
                const newCandle = {
                    ...inputCandle,
                    volume: Number.parseInt(inputCandle.volume as any, 10),
                };
                if (validateCandle(newCandle) === false)
                    throw new Error(JSON.stringify(validateCandle.errors, null, 2));
                return newCandle;
            }),
        );
    } catch (error) {
        Log.error(error);
        throw error;
    }
}

async function removeCandle({ key }: { key: string }): Promise<any> {
    return CandleModel.destroy({ where: { key } });
}

async function flush(): Promise<void> {
    return CandleModel.truncate();
}

export const CandleRepository = {
    upsertCandles,
    getCandle,
    findBy,
    removeCandle,
    flush,
    validate,
};
