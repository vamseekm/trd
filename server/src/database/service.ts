import { Sequelize } from 'sequelize-typescript';

import { Config } from '../infra';
import { CandleModel, InstrumentModel, PrefModel, TickModel } from './model';

async function databaseConnect(): Promise<void> {
    const databaseConfig = Config.get('postgres');
    const seq = new Sequelize({
        ...databaseConfig,
        logging: false,
        models: [PrefModel, InstrumentModel, TickModel, CandleModel],
    });
    await seq.sync({ alter: true });
}

export const DatabaseService = {
    databaseConnect,
};
