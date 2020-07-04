import express from 'express';
import { Service } from 'typedi';

@Service()
export class APIController {
    ping(req: express.Request, res: express.Response): void {
        res.send('pong');
    }

    mountPublicRoutes(r: express.Router): void {
        r.get('/ping', this.ping);
    }
}
