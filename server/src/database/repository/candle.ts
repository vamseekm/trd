import { Op, Sequelize, WhereOptions } from 'sequelize';

import { Log } from '../../infra';
import { Candle, CandleInterval, INSTRUMENT_ID_SEPERATOR } from '../../types';
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
    const candle = await CandleModel.findOne({ where: { key }, raw: true });
    if (candle != undefined) {
        const [validatedCandle] = await validate([candle]);
        return validatedCandle;
    }
    return null;
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
    let where: WhereOptions = {};
    if (from && to) where = { ...where, timestamp: { [Op.gte]: from, [Op.lte]: to } };
    if (interval) where = { ...where, interval };
    if (id) where = { ...where, id };
    if (id && interval) where = { ...where, key: { [Op.like]: `${id}${INSTRUMENT_ID_SEPERATOR}${interval}%` } };
    if (timeCode) where = { ...where, timeCode };
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
    return (
        await CandleModel.findAll({
            attributes: [[Sequelize.fn('min', Sequelize.col('timestamp')), 'date']],
            where: {
                interval,
            },
            group: [Sequelize.fn('date_trunc', 'day', Sequelize.col('timestamp'))],
            order: [[Sequelize.fn('date_trunc', 'day', Sequelize.col('timestamp')), 'ASC']],
            raw: true,
        })
    ).map(({ date }: any) => date as Date);
}

async function getTimeCodesForInterval({
    interval,
    from,
    to,
}: {
    interval: CandleInterval;
    from: Date;
    to: Date;
}): Promise<number[]> {
    return (
        await CandleModel.findAll({
            attributes: [[Sequelize.fn('distinct', Sequelize.col('timeCode')), 'timeCode']],
            where: {
                interval,
                timestamp: { [Op.gte]: from, [Op.lte]: to },
            },
            order: [[Sequelize.col('timeCode'), 'ASC']],
        })
    ).map((row) => row.timeCode);
}

export const CandleRepository = {
    upsertCandles,
    getCandle,
    findBy,
    removeCandle,
    flush,
    validate,
    getTradingDaysForInterval,
    getTimeCodesForInterval,
};
