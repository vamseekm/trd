import { Sequelize } from 'sequelize-typescript';

import { Config } from '../infra';
import { CandleModel, InstrumentModel, PrefModel, TickModel } from './model';

let _seq: Sequelize;

async function connect(): Promise<void> {
    if (_seq != undefined) return;
    const databaseConfig = Config.get('postgres');
    _seq = new Sequelize({
        ...databaseConfig,
        logging: false,
        models: [PrefModel, InstrumentModel, TickModel, CandleModel],
    });
}

async function syncSchema(): Promise<void> {
    if (_seq != undefined) await _seq.sync({ alter: true });
}

export const DatabaseService = {
    connect,
    syncSchema,
};
