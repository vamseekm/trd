import express from 'express';

export function ping(req: express.Request, res: express.Response): void {
    res.send('pong');
}
