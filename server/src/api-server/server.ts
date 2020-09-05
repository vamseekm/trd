import express from 'express';
import displayRoutes from 'express-routemap';
import morgan from 'morgan';

import { BrokerController } from '../broker';
import { get, Log } from '../infra';
import { TaskController } from '../task';
import { HTTP_API_SERVER_PORT, IController } from '../types';
import { handleError } from './middleware';

const GRAPHQL_ENDPOINT = '/api/graphql';
const app: express.Express = express();
app.use(
    morgan('dev', {
        stream: {
            write: (message) => {
                if (!message.includes(GRAPHQL_ENDPOINT)) Log.info(`http > ${message.trim()}`);
            },
        },
    }),
);

const publicRouter = express.Router();
const privateRouter = express.Router();

async function mountRoutes(ctrl: IController, prefix: string): Promise<void> {
    publicRouter.use(prefix, await ctrl.publicRoutes());
    privateRouter.use(prefix, await ctrl.privateRoutes());
}

async function setupRoutes(): Promise<void> {
    mountRoutes(BrokerController, '/broker');
    mountRoutes(TaskController, '/task');
    app.get('/health', (_request, response) => response.send('ok'));
    app.use('/api/open/', publicRouter);
    app.use('/api', privateRouter);
}

// async function setupGraphQL(): Promise<void> {
//     const schema = await buildSchema({
//         resolvers: [InstrumentResolver],
//     });
//     app.use(
//         GRAPHQL_ENDPOINT,
//         graphqlHTTP(() => {
//             return {
//                 schema,
//             };
//         }),
//     );
//     app.use('/api/graphqlui', expressPlayground({ endpoint: '/api/graphql' }));
// }

async function start(): Promise<unknown> {
    // await setupGraphQL();
    await setupRoutes();
    app.use(handleError);
    const port = get(HTTP_API_SERVER_PORT);
    return new Promise((resolve, reject) => {
        app.listen(port, () => {
            Log.info(`API server available at 0.0.0.0:${port}`);
            displayRoutes(app);
            // resolve();
        }).on('error', (error) => {
            Log.error(error);
            reject(error);
        });
    });
}

export const APIServer = {
    start,
};
