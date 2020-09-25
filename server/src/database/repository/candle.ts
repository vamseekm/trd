import { transformAndValidate } from 'class-transformer-validator';
import { Op, Sequelize } from 'sequelize';

import { Log } from '../../infra';
import { Candle, CandleInterval } from '../../types';
import { CandleModel } from '../model';

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
    const keyPrefix = `${id}_${interval}_%`;
    return validate(
        await CandleModel.findAll({ where: { key: { [Op.like]: keyPrefix } }, order: Sequelize.col('key'), raw: true }),
    );
}
async function validate(inputCandles: Candle[]): Promise<Candle[]> {
    try {
        return await Promise.all(
            inputCandles.map((inputCandle) =>
                transformAndValidate(Candle, {
                    ...inputCandle,
                    volume: Number.parseInt(inputCandle.volume as any, 10),
                }),
            ),
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
