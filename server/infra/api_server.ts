import express from 'express';
import { Service } from 'typedi';
import morgan from 'morgan';
import { Config, HTTP_API_PORT } from './config';
import { BrokerController } from '../lib/controller';
import { IController } from '../lib/types';

@Service()
export class APIServer {
    app: express.Express;

    publicRouter: express.Router;

    privateRouter: express.Router;

    constructor(private config: Config, private brokerCtrl: BrokerController) {
        this.app = express();
        this.app.use(morgan('tiny'));
        this.publicRouter = express.Router();
        this.privateRouter = express.Router();
    }

    async mountRoutes(ctrl: IController, prefix: string): Promise<void> {
        this.publicRouter.use(prefix, await this.brokerCtrl.publicRoutes());
    }

    async setupRoutes(): Promise<void> {
        this.mountRoutes(this.brokerCtrl, '/broker');
        this.app.use('/api.public', this.publicRouter);
    }

    async start(): Promise<unknown> {
        await this.setupRoutes();
        const port = await this.config.get(HTTP_API_PORT);
        return new Promise((resolve) => {
            this.app.listen(port, () => {
                console.log(`API server available at 0.0.0.0:${port}`);
                resolve();
            });
        });
    }
}
