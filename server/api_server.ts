/* eslint-disable no-console */
import express from 'express';
import _once from 'lodash.once';
import { ping } from './routes';

const app = express();
const publicRouter = express.Router();

const setupRoutes = _once(() => {
    publicRouter.use('/ping', ping);
    app.use('/api', publicRouter);
});

export async function start(): Promise<void> {
    setupRoutes();
    return new Promise((resolve) => {
        app.listen(process.env.HTTP_API_PORT, () => {
            console.log(`API server available at 0.0.0.0:${process.env.HTTP_API_PORT}`);
            resolve();
        });
    });
}
