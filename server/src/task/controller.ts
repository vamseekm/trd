import express from 'express';

import { expressWrap } from '../api';
import { TaskService } from './service';

async function sync(_request: express.Request, response: express.Response): Promise<void> {
    await TaskService.cron();
    response.send('ok');
}

async function publicRoutes(): Promise<express.Router> {
    return express.Router();
}

async function privateRoutes(): Promise<express.Router> {
    const router = express.Router();
    router.get('/sync', expressWrap(sync));
    return router;
}

export const TaskController = {
    publicRoutes,
    privateRoutes,
};
