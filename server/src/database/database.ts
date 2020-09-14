import { Op } from 'sequelize';
import { Sequelize } from 'sequelize-typescript';

import { Config } from '../infra/config';
import { InstrumentModel } from './instrument.table';
import { PrefModel } from './pref.table';
import { TickModel } from './tick.table';
async function connect(): Promise<void> {
    const databaseConfig = Config.get('postgres');
    const seq = new Sequelize({
        ...databaseConfig,
        logging: false,
        models: [PrefModel, InstrumentModel, TickModel],
        operatorsAliases: {
            $in: Op.in,
            $lt: Op.lt,
            $lte: Op.lte,
            $gt: Op.gt,
            $gte: Op.gte,
            $and: Op.and,
            $or: Op.or,
        },
    });
    await seq.sync({ alter: true });
}

export const Database = {
    connect,
};
