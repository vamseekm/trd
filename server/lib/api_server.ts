import express from 'express';
import { Service } from 'typedi';
import morgan from 'morgan';
import { Config } from '../infra/config';
import { BrokerController, TasksController } from './controller';
import { IController, HTTP_API_PORT } from './types';

@Service()
export class APIServer {
    app: express.Express;

    publicRouter: express.Router;

    privateRouter: express.Router;

    constructor(private config: Config, private brokerCtrl: BrokerController, private tasksCtrl: TasksController) {
        this.app = express();
        this.app.use(morgan('tiny'));
        this.publicRouter = express.Router();
        this.privateRouter = express.Router();
    }

    async mountRoutes(ctrl: IController, prefix: string): Promise<void> {
        this.publicRouter.use(prefix, await ctrl.publicRoutes());
        this.privateRouter.use(prefix, await ctrl.privateRoutes());
    }

    async setupRoutes(): Promise<void> {
        this.mountRoutes(this.brokerCtrl, '/broker');
        this.mountRoutes(this.tasksCtrl, '/tasks');
        this.app.get('/health', (req, res) => res.send('Ok'));
        this.app.use('/api.public', this.publicRouter);
        this.app.use('/api', this.privateRouter);
    }

    async start(): Promise<unknown> {
        await this.setupRoutes();
        const port = this.config.get(HTTP_API_PORT);
        return new Promise((resolve) => {
            this.app.listen(port, () => {
                console.log(`API server available at 0.0.0.0:${port}`);
                resolve();
            });
        });
    }
}
