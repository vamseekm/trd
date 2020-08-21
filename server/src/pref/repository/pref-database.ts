import { getRepository } from 'typeorm';

import { Pref } from '../entity';
async function findBy(search: Partial<Pref>): Promise<Pref | undefined> {
    return getRepository(Pref).findOne(search);
}

async function upsert(pref: Pref): Promise<void> {
    const { key } = pref;
    const prefRepo = getRepository(Pref);
    if ((await prefRepo.count({ key })) === 0) {
        await prefRepo.insert(pref);
    } else {
        await prefRepo.update({ key }, pref);
    }
}

export const PrefDBRepostiory = {
    findBy,
    upsert,
};
