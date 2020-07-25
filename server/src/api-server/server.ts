import express from 'express';
import { graphqlHTTP } from 'express-graphql';
import displayRoutes from 'express-routemap';
import { getIntrospectionQuery } from 'graphql';
import expressPlayground from 'graphql-playground-middleware-express';
import morgan from 'morgan';
import { buildSchema } from 'type-graphql';
import Container, { Service } from 'typedi';

import { BrokerController } from '../broker';
import { Config, LoggerService } from '../infra';
import { InstrumentResolver } from '../instrument';
import { TaskController } from '../task';
import { HTTP_API_PORT, IController } from '../types';
import { handleError } from './middleware';

const GRAPHQL_ENDPOINT = '/api/graphql';
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
        this.app.use(
            morgan('dev', {
                stream: {
                    write: (message) => {
                        if (!message.includes(GRAPHQL_ENDPOINT)) this.logger.info(`http > ${message.trim()}`);
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
        this.app.get('/health', (request, response) => {
            this.logger.info('heartbeat');
            response.send('ok');
        });
        this.app.use('/api/open/', this.publicRouter);
        this.app.use('/api', this.privateRouter);
    }

    async setupGraphQL(): Promise<void> {
        const schema = await buildSchema({
            resolvers: [InstrumentResolver],
            container: Container,
        });
        this.app.use(
            GRAPHQL_ENDPOINT,
            graphqlHTTP(() => {
                return {
                    schema,
                };
            }),
        );
        this.app.use('/api/graphqlui', expressPlayground({ endpoint: '/api/graphql' }));
    }

    async start(): Promise<unknown> {
        await this.setupGraphQL();
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
