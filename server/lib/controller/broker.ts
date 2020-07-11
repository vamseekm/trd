/* eslint-disable camelcase */
/* eslint-disable no-useless-constructor */
import express from 'express';
import { Service } from 'typedi';
import autoBind from 'auto-bind';
import { IController } from '../types';
import { BrokerAPI } from '../api';
import { Logger } from '../../infra';

@Service()
export class BrokerController implements IController {
    constructor(private brokerAPI: BrokerAPI, private broker: BrokerAPI, private logger: Logger) {
        autoBind(this);
    }

    async login(req: express.Request, res: express.Response): Promise<void> {
        const loginUrl = await this.brokerAPI.getLoginUrl();
        res.redirect(307, loginUrl);
    }

    async redirect(req: express.Request, res: express.Response, next: express.NextFunction): Promise<void> {
        try {
            const { request_token } = req.query;
            await this.brokerAPI.generateAccessToken(request_token as string);
            res.send('generated access token');
        } catch (err) {
            this.logger.error(err);
            next(JSON.stringify(err, null, 2));
        }
    }

    async profile(req: express.Request, res: express.Response): Promise<void> {
        const profile = await this.broker.getProfile();
        res.send(profile);
    }

    async privateRoutes(): Promise<express.Router> {
        const router = express.Router();
        router.get('/profile', this.profile);
        return router;
    }

    async publicRoutes(): Promise<express.Router> {
        const router = express.Router();
        router.get('/login', this.login);
        router.get('/redirect', this.redirect);
        return router;
    }
}
