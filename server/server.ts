/* eslint-disable no-console */
import express from 'express';
import { HTTP_API_PORT } from './config';

const app = express();

app.get('/health', (req, res) => {
    res.send('hi what ?');
});

export function start() {
    return new Promise((resolve) => {
        app.listen(HTTP_API_PORT, 'localhost', () => {
            console.log(`API server available at localhost:${HTTP_API_PORT} ...`);
            resolve();
        });
    });
}
