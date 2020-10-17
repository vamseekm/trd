import { Sequelize } from 'sequelize-typescript';

import { Config } from '../infra';
import { CandleModel, InstrumentModel, PrefModel, TickModel } from './model';

let _seq: Sequelize;

function connect(): Sequelize {
    if (_seq != undefined) return _seq;
    return (_seq = new Sequelize({
        ...Config.get('postgres'),
        logging: false,
        models: [PrefModel, InstrumentModel, TickModel, CandleModel],
    }));
}

async function syncSchema(): Promise<Sequelize> {
    return connect().sync({ alter: true });
}

export const DatabaseService = {
    connect,
    syncSchema,
};
