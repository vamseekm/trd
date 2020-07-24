import autoBind from 'auto-bind';
import express from 'express';
import { Service } from 'typedi';
import { getRepository } from 'typeorm';

import { expressWrap, throwNotFound, throwServerError } from '../api-server';
import { IController } from '../types';
import { Instrument } from './entity';
import { InstrumentService } from './service';

@Service()
export class InstrumentController implements IController {
    constructor(private instrumentSvc: InstrumentService) {
        autoBind(this);
    }

    async bySymbol(request: express.Request, response: express.Response): Promise<void> {
        const { symbol } = request.params;
        if (!symbol) throwServerError('Supply symbol');
        const instrument = await getRepository(Instrument)
            .createQueryBuilder()
            .where({ globalSymbol: symbol })
            .getOne();
        if (!instrument) throwNotFound(`${symbol} not found.`);
        response.send(instrument);
    }

    async publicRoutes(): Promise<express.Router> {
        return express.Router();
    }

    async privateRoutes(): Promise<express.Router> {
        const router = express.Router();
        router.get('/:symbol', expressWrap(this.bySymbol));
        return router;
    }
}
