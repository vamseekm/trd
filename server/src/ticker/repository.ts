import { TickModel } from '../database';
import { ITick } from '../types';

async function bulkInsert(ticks: ITick[]): Promise<void> {
    await TickModel.bulkCreate(ticks);
}

export const TickRepository = {
    bulkInsert,
};
