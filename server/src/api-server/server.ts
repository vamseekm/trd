import express from 'express';
import morgan from 'morgan';
import { Service } from 'typedi';

import { BrokerController } from '../broker';
import { Config, LoggerService } from '../infra';
import { TaskController } from '../task';
import { HTTP_API_PORT, IController } from '../types';

@Service()
export class APIServer {
    app: express.Express;

    publicRouter: express.Router;

    privateRouter: express.Router;

    constructor(
        private config: Config,
        private brokerCtrl: BrokerController,
        private tasksCtrl: TaskController,
        private logger: LoggerService,
    ) {
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
        this.app.get('/health', (request, response) => {
            this.logger.info('heartbeat');
            response.send('ok');
        });
        this.app.use('/api.public', this.publicRouter);
        this.app.use('/api', this.privateRouter);
    }

    async start(): Promise<unknown> {
        await this.setupRoutes();
        const port = this.config.get(HTTP_API_PORT);
        return new Promise((resolve, reject) => {
            this.app
                .listen(port, () => {
                    this.logger.info(`API server available at 0.0.0.0:${port}`);
                    // resolve();
                })
                .on('error', (error) => {
                    this.logger.error(error);
                    reject(error);
                });
        });
    }
}
