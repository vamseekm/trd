import autoBind from 'auto-bind';
import express from 'express';
import { Service } from 'typedi';

import { IController } from '../types';
import { TaskService } from './service';

@Service()
export class TaskController implements IController {
    constructor(private tasks: TaskService) {
        autoBind(this);
    }

    async sync(request: express.Request, response: express.Response, next: express.NextFunction): Promise<void> {
        try {
            await this.tasks.sync();
            response.send('ok');
        } catch (error) {
            next(error);
        }
    }

    async publicRoutes(): Promise<express.Router> {
        return express.Router();
    }

    async privateRoutes(): Promise<express.Router> {
        const router = express.Router();
        router.get('/sync', this.sync);
        return router;
    }
}
