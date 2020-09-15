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
    });
    await seq.sync({ alter: true });
}

export const Database = {
    connect,
};
