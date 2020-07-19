/* eslint-disable camelcase */
/* eslint-disable no-useless-constructor */
import autoBind from 'auto-bind';
import express from 'express';
import { Service } from 'typedi';

import { LoggerService } from '../infra';
import { IController } from '../types';
import { BrokerService } from './service';

@Service()
export class BrokerController implements IController {
    constructor(private logger: LoggerService, private broker: BrokerService) {
        autoBind(this);
    }

    async login(request: express.Request, response: express.Response): Promise<void> {
        const loginUrl = await this.broker.getLoginUrl();
        response.redirect(307, loginUrl);
    }

    async redirect(request: express.Request, response: express.Response, next: express.NextFunction): Promise<void> {
        try {
            const { request_token } = request.query;
            await this.broker.generateAccessToken(request_token as string);
            response.send('generated access token');
        } catch (error) {
            this.logger.error('my error:', error);
            next(error);
            // next(JSON.stringify(err, null, 2));
        }
    }

    async profile(request: express.Request, response: express.Response): Promise<void> {
        const profile = await this.broker.getProfile();
        response.send(profile);
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
