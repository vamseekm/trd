import { Service } from 'typedi';
import express from 'express';
import autoBind from 'auto-bind';
import { Tasks } from '../tasks';
import { IController } from '../types';

@Service()
export class TasksController implements IController {
    constructor(private tasks: Tasks) {
        autoBind(this);
    }

    async sync(req: express.Request, res: express.Response): Promise<void> {
        await this.tasks.sync();
        res.send('ok');
    }

    async publicRoutes(): Promise<express.Router> {
        const router = express.Router();
        return router;
    }

    async privateRoutes(): Promise<express.Router> {
        const router = express.Router();
        router.get('/sync', this.sync);
        return router;
    }
}
