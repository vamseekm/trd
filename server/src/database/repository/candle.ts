import { plainToClass } from 'class-transformer';
import { validateOrReject } from 'class-validator';
import { Op, Sequelize } from 'sequelize';

import { Log } from '../../infra';
import { Candle, CandleInterval } from '../../types';
import { CandleModel } from '../model';

async function upsertCandles(inputCandleList: Candle[]): Promise<any> {
    return CandleModel.bulkCreate(inputCandleList, {
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
    const candles = await Promise.all(
        inputCandles.map((inputCandle) =>
            plainToClass(Candle, { ...inputCandle, volume: Number.parseInt(inputCandle.volume as any, 10) }),
        ),
    );
    try {
        await Promise.all(candles.map((candle) => validateOrReject(candle)));
    } catch (error) {
        Log.error(error);
    }
    return candles;
}

export const CandleRepository = {
    upsertCandles,
    getCandle,
    findBy,
};
