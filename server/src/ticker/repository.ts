import { Service } from 'typedi';
import { getRepository, InsertResult } from 'typeorm';

import { Tick } from './entity';

@Service()
export class TickRepository {
    bulkInsert(items: Tick[]): Promise<InsertResult> {
        return getRepository(Tick).insert(items);
    }

    create(tick: Partial<Tick>): Tick {
        return getRepository(Tick).create(tick);
    }
}
