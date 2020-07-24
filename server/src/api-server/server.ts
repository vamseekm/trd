import express from 'express';
import displayRoutes from 'express-routemap';
import morgan from 'morgan';
import { Service } from 'typedi';

import { BrokerController } from '../broker';
import { Config, LoggerService } from '../infra';
import { InstrumentController } from '../instrument';
import { TaskController } from '../task';
import { HTTP_API_PORT, IController } from '../types';
import { handleError } from './middleware';

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
        private instrumentCtrl: InstrumentController,
    ) {
        this.app = express();
        this.app.use(
            morgan('dev', {
                stream: {
                    write: (message) => {
                        this.logger.info(`http > ${message.trim()}`);
                    },
                },
            }),
        );
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
        this.mountRoutes(this.instrumentCtrl, '/instrument');
        this.app.get('/health', (request, response) => {
            this.logger.info('heartbeat');
            response.send('ok');
        });
        this.app.use('/api/open/', this.publicRouter);
        this.app.use('/api', this.privateRouter);
    }

    async start(): Promise<unknown> {
        await this.setupRoutes();
        this.app.use(handleError);
        const port = this.config.get(HTTP_API_PORT);
        return new Promise((resolve, reject) => {
            this.app
                .listen(port, () => {
                    this.logger.info(`API server available at 0.0.0.0:${port}`);
                    displayRoutes(this.app);
                    // resolve();
                })
                .on('error', (error) => {
                    this.logger.error(error);
                    reject(error);
                });
        });
    }
}
