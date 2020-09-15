// function bulkInsert(items: Tick[]): Promise<InsertResult> {
//     return getRepository(Tick).insert(items);
// }

import { TickModel } from '../database/tick.table';
import { ITick } from '../types';

// function create(tick: Partial<Tick>): Tick {
//     return getRepository(Tick).create(tick);
// }
async function storeTicks(ticks: ITick[]): Promise<void> {
    await TickModel.bulkCreate(ticks);
}

export const TickRepository = {
    // bulkInsert,
    // create,
    storeTicks,
};
