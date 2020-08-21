import express from 'express';
import { graphqlHTTP } from 'express-graphql';
import displayRoutes from 'express-routemap';
import expressPlayground from 'graphql-playground-middleware-express';
import morgan from 'morgan';
import { buildSchema } from 'type-graphql';
import Container, { Service } from 'typedi';

import { BrokerController } from '../broker';
import { configGet, logError, logInfo } from '../infra';
import { InstrumentResolver } from '../instrument';
import { TaskController } from '../task';
import { HTTP_API_SERVER_PORT, IController } from '../types';
import { handleError } from './middleware';

const GRAPHQL_ENDPOINT = '/api/graphql';
@Service()
export class APIServer {
    app: express.Express;

    publicRouter: express.Router;

    privateRouter: express.Router;

    constructor(private taskCtrl: TaskController) {
        this.app = express();
        this.app.use(
            morgan('dev', {
                stream: {
                    write: (message) => {
                        if (!message.includes(GRAPHQL_ENDPOINT)) logInfo(`http > ${message.trim()}`);
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
        this.mountRoutes(BrokerController, '/broker');
        this.mountRoutes(BrokerController, '/task');
        this.app.get('/health', (request, response) => {
            logInfo('heartbeat');
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
        const port = configGet(HTTP_API_SERVER_PORT);
        console.log(port);
        return new Promise((resolve, reject) => {
            this.app
                .listen(port, () => {
                    logInfo(`API server available at 0.0.0.0:${port}`);
                    displayRoutes(this.app);
                    // resolve();
                })
                .on('error', (error) => {
                    logError(error);
                    reject(error);
                });
        });
    }
}
