import { Op } from 'sequelize';

import { Tick } from '../../types';
import { TickModel } from '../model';

async function bulkInsert(ticks: Tick[]): Promise<void> {
    await TickModel.bulkCreate(ticks);
}

async function removeDataOlderThan(olderThan: Date): Promise<number> {
    return await TickModel.destroy({ where: { timestamp: { [Op.lt]: olderThan } } });
}

export const TickRepository = {
    bulkInsert,
    removeDataOlderThan,
};
