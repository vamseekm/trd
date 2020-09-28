import { Op, Sequelize } from 'sequelize';

import { Log } from '../../infra';
import { Candle, CandleInterval, INSTRUMENT_ID_SEPERATOR } from '../../types';
import { CandleModel } from '../model';
import { validateCandle } from '../../types/candle';

async function upsertCandles(inputCandleList: Candle[]): Promise<any> {
    return await CandleModel.bulkCreate(inputCandleList, {
        updateOnDuplicate: [
            'timestamp',
            'open',
            'high',
            'low',
            'close',
            'volume',
            'openInterest',
            'totalVolume',
            'totalOpenInterest',
        ],
    });
}

async function getCandle(key: string): Promise<Candle | null> {
    return CandleModel.findOne({ where: { key }, raw: true });
}

async function findBy({ id, interval }: { id: string; interval: CandleInterval }): Promise<Candle[]> {
    const keyPrefix = `${id}${INSTRUMENT_ID_SEPERATOR}${interval}${INSTRUMENT_ID_SEPERATOR}%`;
    console.log(keyPrefix);
    return validate(
        await CandleModel.findAll({ where: { key: { [Op.like]: keyPrefix } }, order: Sequelize.col('key'), raw: true }),
    );
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

export const CandleRepository = {
    upsertCandles,
    getCandle,
    findBy,
};
