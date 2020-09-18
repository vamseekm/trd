import { Sequelize } from 'sequelize-typescript';

import { Config } from '../infra/config';
import { CandleModel } from './candle.table';
import { InstrumentModel } from './instrument.table';
import { PrefModel } from './pref.table';
import { TickModel } from './tick.table';
async function connect(): Promise<void> {
    const databaseConfig = Config.get('postgres');
    const seq = new Sequelize({
        ...databaseConfig,
        logging: false,
        models: [PrefModel, InstrumentModel, TickModel, CandleModel],
    });
    await seq.sync({ alter: true });
}

export const Database = {
    connect,
};
