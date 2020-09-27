/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { diff as diffObject } from 'deep-diff';
import lodash from 'lodash';
import { DateTime } from 'luxon';
import { FindOptions, Op, Sequelize, WhereAttributeHash } from 'sequelize';

import { Instrument, UpsertResults } from '../../types';
import { toSetAndMap } from '../../util';
import { InstrumentModel } from '../model';
async function fetchFnoInstruments({
    name,
    exchange = 'NFO',
    segment = 'NFO-FUT',
    expiry = new Date(),
    take,
}: {
    name: string;
    exchange?: string;
    segment?: string;
    expiry?: Date;
    take?: number;
}): Promise<Instrument[]> {
    let options: FindOptions = { where: { name, exchange, segment, expiry: { [Op.gte]: expiry } }, raw: true };
    if (take != undefined) options = { ...options, limit: take };
    return InstrumentModel.findAll(options);
}

async function fetchOptions(name: string): Promise<Instrument[]> {
    return InstrumentModel.findAll({
        where: { name, exchange: 'NFO', segment: 'NFO-OPT', live: true },
        order: [['expiry', 'ASC']],
    });
}

async function updateInstrument({ id, ...rest }: Partial<Instrument>): Promise<any> {
    if (id == undefined) throw new Error(`id can't be undefined.`);
    return InstrumentModel.update(rest, { where: { id } });
}

async function updateInstruments(instrumentList: Array<Partial<Instrument>>): Promise<any> {
    return await Promise.all(
        instrumentList.map((instrument: Partial<Instrument>) => {
            return updateInstrument(instrument);
        }),
    );
}

async function bulkUpdateInstruments(idList: string[], data: Partial<Instrument>) {
    return InstrumentModel.update(data, { where: { id: { [Op.in]: idList } } });
}

async function trackInstruments(idList: string[], track: boolean): Promise<any> {
    return bulkUpdateInstruments(idList, { track });
}

async function exchangeList(): Promise<string[]> {
    return InstrumentModel.aggregate('exchange', 'distinct');
    // return InstrumentModel.distinct('exchange').exec();
}

async function upsertInstruments(exchange: string, inputInstruments: Instrument[]): Promise<UpsertResults> {
    if (inputInstruments.length === 0) return { insert: 0, update: 0, remove: 0 };
    const fieldsToCompare = Object.keys(inputInstruments[0]);
    const databaseInstruments: Instrument[] = (
        await InstrumentModel.findAll({ where: { exchange, live: true }, raw: true })
    ).map((item) => {
        return lodash.pick(item, fieldsToCompare) as Instrument;
    });
    const database = toSetAndMap(databaseInstruments, 'id');
    const input = toSetAndMap(inputInstruments, 'id');
    const commonIds = new Set<string>();
    const insertInstruments: Instrument[] = [];
    input.set.forEach((id) => {
        if (database.set.has(id) && input.set.has(id)) commonIds.add(id);
        if (!database.set.has(id)) insertInstruments.push(input.map.get(id) as Instrument);
    });
    const removedIds = new Set<string>();
    database.set.forEach((id) => {
        if (database.set.has(id) && input.set.has(id)) commonIds.add(id);
        if (!input.set.has(id)) removedIds.add(id);
    });
    const updateInstruments: Instrument[] = [];
    commonIds.forEach((commonId) => {
        const diff = diffObject(input.map.get(commonId), database.map.get(commonId));
        if (diff != undefined) updateInstruments.push(input.map.get(commonId) as Instrument);
    });
    const upsertInstruments = [...insertInstruments, ...updateInstruments];
    if (upsertInstruments.length > 0) {
        await InstrumentModel.bulkCreate(upsertInstruments, {
            updateOnDuplicate: Object.keys(upsertInstruments[0]) as any,
        });
    }
    if (removedIds.size > 0) {
        await bulkUpdateInstruments([...removedIds], { live: false });
    }
    return { insert: insertInstruments.length, update: updateInstruments.length, remove: removedIds.size };
}

async function findOptions({
    expiry,
    name,
    segment,
    strikeLimitLow,
    strikeLimitHigh,
    strikeInterval,
}: {
    expiry: Date;
    name: string;
    segment: string;
    strikeLimitLow: number;
    strikeLimitHigh: number;
    strikeInterval: number;
}): Promise<Instrument[]> {
    return _findBy({
        where: {
            [Op.and]: [
                { expiry },
                { name },
                { segment },
                {
                    strike: {
                        [Op.gte]: strikeLimitLow,
                        [Op.lte]: strikeLimitHigh,
                    },
                },
                Sequelize.where(
                    Sequelize.fn(
                        'mod',
                        Sequelize.cast(Sequelize.col('strike'), 'numeric'),
                        Sequelize.literal(`${strikeInterval}`),
                    ),
                    Sequelize.literal('0'),
                ),
            ],
        },
        order: [['strike', 'ASC']],
    });
}

async function findTopInstruments({ exchange, take }: { exchange: string; take: number }): Promise<Instrument[]> {
    return InstrumentModel.findAll({ where: { exchange }, order: [['rank', 'ASC']], limit: take, raw: true });
}

async function findInstrumentsWithPendingLTPUpdates({
    maxExpiry,
    lastUpdatedBefore,
}: {
    maxExpiry: Date;
    lastUpdatedBefore: Date;
}): Promise<Instrument[]> {
    return await _findBy({
        where: {
            live: true,
            [Op.and]: [
                { expiry: { [Op.lt]: maxExpiry } },
                {
                    [Op.or]: [{ lastPriceUpdatedOn: { [Op.lt]: lastUpdatedBefore } }, { lastPrice: 0 }],
                },
            ],
        },
    });
}

async function findAllInstruments(maxExpiry: Date): Promise<Instrument[]> {
    return _findBy({
        where: {
            segment: { [Op.in]: ['INDICES', 'NFO-FUT', 'NSE'] },
            expiry: { [Op.lt]: maxExpiry },
        },
    });
}

async function findTrackedFutures(name: string): Promise<Instrument[]> {
    return _findBy({ where: { name, segment: 'NFO-FUT', live: true, track: true }, order: [['expiry', 'ASC']] });
}

async function findTrackedInstruments(): Promise<Instrument[]> {
    return _findBy({ where: { track: true } });
}

async function _findBy({ where, order = [] }: { where: WhereAttributeHash; order?: any[] }): Promise<Instrument[]> {
    return InstrumentModel.findAll({ where, order, raw: true });
}
async function _findOneBy({
    where,
    order = [],
}: {
    where: WhereAttributeHash;
    order?: any[];
}): Promise<Instrument | null> {
    return InstrumentModel.findOne({ where, order, raw: true });
}

async function findAutoTrackedInstruments(): Promise<Instrument[]> {
    return _findBy({ where: { track: true } });
}

async function findById(id: string): Promise<Instrument | null> {
    return _findOneBy({ where: { id } });
}

async function findByInstrumentToken(instrumentToken: string): Promise<Instrument | null> {
    return _findOneBy({ where: { instrumentToken } });
}

async function findByOutdatedMeta(): Promise<Instrument[]> {
    return InstrumentModel.findAll({
        where: {
            [Op.and]: [
                {
                    exchange: 'NSE',
                },
                {
                    [Op.or]: [
                        {
                            metaLastUpdated: null,
                        },
                        {
                            metaLastUpdated: {
                                [Op.lte]: DateTime.local().minus({ day: 7 }).toJSDate(),
                            },
                        },
                    ],
                },
            ],
        },
        raw: true,
    });
}

async function findWithMetaLastUpdated(): Promise<Instrument[]> {
    return InstrumentModel.findAll({
        where: {
            metaLastUpdated: {
                [Op.ne]: null,
            },
        },
        raw: true,
    });
}

export const InstrumentRepository = {
    exchangeList,
    fetchFnoInstruments,
    fetchOptions,
    findAllInstruments,
    findInstrumentsWithPendingLTPUpdates,
    findOptions,
    findTopInstruments,
    findTrackedFutures,
    findTrackedInstruments,
    findAutoTrackedInstruments,
    trackInstruments,
    updateInstrument,
    updateInstruments,
    upsertInstruments,
    findById,
    findByInstrumentToken,
    findByOutdatedMeta,
    findWithMetaLastUpdated,
};
