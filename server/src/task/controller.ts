import autoBind from 'auto-bind';
import express from 'express';
import { Service } from 'typedi';

import { expressWrap } from '../api-server';
import { IController } from '../types';
import { TaskService } from './service';

@Service()
export class TaskController implements IController {
    constructor(private tasks: TaskService) {
        autoBind(this);
    }

    async sync(request: express.Request, response: express.Response): Promise<void> {
        await this.tasks.sync();
        response.send('ok');
    }

    async publicRoutes(): Promise<express.Router> {
        return express.Router();
    }

    async privateRoutes(): Promise<express.Router> {
        const router = express.Router();
        router.get('/sync', expressWrap(this.sync));
        return router;
    }
}
