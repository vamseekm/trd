/* eslint-disable camelcase */
/* eslint-disable no-useless-constructor */
import express from 'express';

import { expressWrap } from '../api-server';
import { IController } from '../types';
import { BrokerService } from './service';

async function login(_request: express.Request, response: express.Response): Promise<void> {
    const loginUrl = await BrokerService.getLoginUrl();
    response.redirect(307, loginUrl);
}

async function redirect(request: express.Request, response: express.Response): Promise<void> {
    const { request_token } = request.query;
    await BrokerService.generateAccessToken(request_token as string);
    response.send('Generated access token.');
}

async function profile(_request: express.Request, response: express.Response): Promise<void> {
    const profile = BrokerService.getProfile();
    response.send(profile);
}

async function privateRoutes(): Promise<express.Router> {
    const router = express.Router();
    router.get('/profile', expressWrap(profile));
    return router;
}

async function publicRoutes(): Promise<express.Router> {
    const router = express.Router();
    router.get('/login', expressWrap(login));
    router.get('/redirect', expressWrap(redirect));
    return router;
}

export const BrokerController: IController = {
    publicRoutes,
    privateRoutes,
};
