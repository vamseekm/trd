import { Op, Sequelize, WhereOptions } from 'sequelize';

import { Log } from '../../infrastructure';
import { Candle, CandleInterval, InstrumentConsts, validateCandle } from '../../types';
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
    const candle = await CandleModel.findOne({ where: { key }, raw: true });
    if (candle != undefined) return validate([candle])[0];
    return null;
}

async function getCandles(keys: string[]): Promise<Candle[]> {
    const candles = await CandleModel.findAll({ where: { key: { [Op.in]: keys } }, raw: true });
    return validate(candles);
}

async function findBy({
    id,
    interval,
    from,
    to,
    timeCode,
}: {
    id?: string;
    interval?: CandleInterval;
    from?: Date;
    to?: Date;
    timeCode?: number;
}): Promise<Candle[]> {
    const where: WhereOptions = {
        ...(from && to && { timestamp: { [Op.gte]: from, [Op.lte]: to } }),
        ...(interval && { interval }),
        ...(id && { id }),
        ...(id && interval && { key: { [Op.like]: `${id}${InstrumentConsts.ID_SEPERATOR}${interval}%` } }),
        ...(timeCode && { timeCode }),
    };
    if (Object.keys(where).length === 0) throw new Error('Please specify atleast one where condition.');
    return validate(await CandleModel.findAll({ where, order: Sequelize.col('key'), raw: true }));
}

function validate(inputCandles: Candle[]): Candle[] {
    try {
        return inputCandles.map((inputCandle) => {
            const newCandle = {
                ...inputCandle,
                volume: Number.parseInt(inputCandle.volume as any, 10),
            };
            if (validateCandle(newCandle) === false) throw new Error(JSON.stringify(validateCandle.errors, null, 2));
            return newCandle;
        });
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

async function getTradingDaysForInterval(interval: CandleInterval): Promise<Date[]> {
    const rows = await CandleModel.findAll({
        attributes: [[Sequelize.fn('min', Sequelize.col('timestamp')), 'date']],
        where: {
            interval,
        },
        group: [Sequelize.fn('date_trunc', 'day', Sequelize.col('timestamp'))],
        order: [[Sequelize.fn('date_trunc', 'day', Sequelize.col('timestamp')), 'ASC']],
        raw: true,
    });
    return rows.map(({ date }: any) => date);
}

async function getTimeCodesForInterval({
    interval,
    from,
    to,
    limit,
}: {
    interval: CandleInterval;
    from: Date;
    to: Date;
    limit?: number;
}): Promise<number[]> {
    const rows = await CandleModel.findAll({
        attributes: [[Sequelize.fn('distinct', Sequelize.col('timeCode')), 'timeCode']],
        where: {
            interval,
            timestamp: { [Op.gte]: from, [Op.lte]: to },
        },
        order: [[Sequelize.col('timeCode'), 'DESC']],
        ...(limit != undefined && { limit }),
        raw: true,
    });
    return rows.map((row) => row.timeCode).reverse();
}

export const CandleRepository = {
    upsertCandles,
    getCandle,
    getCandles,
    findBy,
    removeCandle,
    flush,
    validate,
    getTradingDaysForInterval,
    getTimeCodesForInterval,
};
