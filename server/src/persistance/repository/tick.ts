import { Op, Sequelize } from 'sequelize';

import { Tick } from '../../types';
import { toDayAndTime } from '../../util/time';
import { TickModel } from '../model';

async function bulkInsert(ticks: Tick[]): Promise<void> {
    await TickModel.bulkCreate(ticks);
}

async function removeDataOlderThan(olderThan: Date): Promise<number> {
    return await TickModel.destroy({ where: { timestamp: { [Op.lt]: olderThan } } });
}

async function getTradingDays(): Promise<Date[]> {
    const rows = await TickModel.findAll({
        attributes: [[Sequelize.fn('min', Sequelize.col('timestamp')), 'date']],
        group: [Sequelize.fn('date_trunc', 'day', Sequelize.col('timestamp'))],
        order: [[Sequelize.fn('date_trunc', 'day', Sequelize.col('timestamp')), 'ASC']],
        raw: true,
    });
    return rows.map(({ date }: any) => date as Date);
}
async function getUniqueInstruments(): Promise<string[]> {
    const rows = await TickModel.findAll({
        attributes: [[Sequelize.fn('distinct', Sequelize.col('instrumentId')), 'instrumentId']],
        raw: true,
    });
    return rows.map((tick) => tick.instrumentId);
}

async function getTicksByInstrumentId(instrumentId: string): Promise<Tick[]> {
    const ticks = await TickModel.findAll({
        where: { instrumentId },
        order: [['timestamp', 'ASC']],
        raw: true,
    });
    return ticks.map((tick) => {
        const { day, time } = toDayAndTime(tick.timestamp);
        return { ...tick, day: parseInt(day, 10), time: parseInt(time, 10) };
    });
}

export const TickRepository = {
    bulkInsert,
    getTradingDays,
    getUniqueInstruments,
    removeDataOlderThan,
    getTicksByInstrumentId,
};
