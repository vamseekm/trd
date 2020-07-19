import autoBind from 'auto-bind';
import { spawn } from 'child_process';
import express from 'express';
import { Service } from 'typedi';

import { IController } from '../types';
import { TaskService } from './service';

async function runTask(cmd: string) {
    return new Promise((resolve, reject) => {
        // const fullCmd = `bash ./server.sh --${cmd}`;
        const child = spawn('npm', ['run', 'server', '--', `--${cmd}`, '-x']);
        child.on('exit', (code, signal) => {
            resolve({ code, signal });
        });
        child.on('error', (error) => {
            reject(error);
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
