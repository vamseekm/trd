import { Service } from 'typedi';
import { getRepository, InsertResult } from 'typeorm';

import { Tick } from './entity';

function bulkInsert(items: Tick[]): Promise<InsertResult> {
    return getRepository(Tick).insert(items);
}

function create(tick: Partial<Tick>): Tick {
    return getRepository(Tick).create(tick);
}

export const TickRepository = {
    bulkInsert,
    create,
};
