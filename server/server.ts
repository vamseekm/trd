/* eslint-disable no-console */
import express from 'express';

const app = express();

app.get('/health', (req, res) => {
    res.send('hi what ');
});

export function start() {
    return new Promise((resolve) => {
        app.listen(process.env.HTTP_API_PORT, () => {
            console.log(`API server available at 0.0.0.0:${process.env.HTTP_API_PORT}`) 
            resolve();
        });
    });
}
