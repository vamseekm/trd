import { Service } from 'typedi';
import { getRepository } from 'typeorm';

import { Pref } from '../entity';

@Service()
export class PrefDBRepostiory {
    async findBy(search: Partial<Pref>): Promise<Pref | undefined> {
        return getRepository(Pref).findOne(search);
    }

    async upsert(pref: Pref): Promise<void> {
        const { key } = pref;
        const prefRepo = getRepository(Pref);
        if ((await prefRepo.count({ key })) === 0) {
            await prefRepo.insert(pref);
        } else {
            await prefRepo.update({ key }, pref);
        }
    }
}
