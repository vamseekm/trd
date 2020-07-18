import { Service } from 'typedi';
import express from 'express';
import autoBind from 'auto-bind';
import { spawn } from 'child_process';
import { nextTick } from 'process';
import { Tasks } from '../tasks';
import { IController } from '../types';

async function runTask(cmd: string) {
    return new Promise((resolve, reject) => {
        // const fullCmd = `bash ./server.sh --${cmd}`;
        const child = spawn('npm', ['run', 'server', '--', `--${cmd}`, '-x']);
        child.on('exit', (code, signal) => {
            resolve({ code, signal });
        });
        child.on('error', (err) => {
            reject(err);
        });
        child.on('close', () => {
            resolve();
        });
        child.stdout.on('data', (data) => {
            process.stdout.write(data.toString());
        });
        child.stderr.on('data', (data) => {
            process.stdout.write(data.toString());
        });
    });
}

@Service()
export class TasksController implements IController {
    constructor(private tasks: Tasks) {
        autoBind(this);
    }

    async sync(req: express.Request, res: express.Response, next: express.NextFunction): Promise<void> {
        try {
            await this.tasks.sync();
            res.send('ok');
        } catch (err) {
            next(err);
        }
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
