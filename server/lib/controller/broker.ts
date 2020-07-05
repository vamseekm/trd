/* eslint-disable camelcase */
/* eslint-disable no-useless-constructor */
import express from 'express';
import { Service } from 'typedi';
import autoBind from 'auto-bind';
import { IController } from '../types';
import { BrokerService } from '../../services';

@Service()
export class BrokerController implements IController {
    constructor(private broker: BrokerService) {
        autoBind(this);
    }

    async login(req: express.Request, res: express.Response): Promise<void> {
        const loginUrl = await this.broker.getLoginUrl();
        res.redirect(307, loginUrl);
    }

    async redirect(req: express.Request, res: express.Response, next: express.NextFunction): Promise<void> {
        try {
            const { request_token } = req.query;
            await this.broker.generateAccessToken(request_token as string);
            res.send('generated access token');
        } catch (err) {
            console.log(err);
            next(JSON.stringify(err, null, 2));
        }
    }

    async publicRoutes(): Promise<express.Router> {
        const router = express.Router();
        router.get('/login', this.login);
        router.get('/redirect', this.redirect);
        return router;
    }
}
