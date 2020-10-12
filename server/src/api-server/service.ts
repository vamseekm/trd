import express from 'express';
import displayRoutes from 'express-routemap';
import morgan from 'morgan';

import { BrokerController } from '../broker';
import { Config, Log } from '../infra';
import { TaskController } from '../task';
import { HTTP_API_SERVER_PORT, IController } from '../types';
import { handleError } from './middleware';

const GRAPHQL_ENDPOINT = '/api/graphql';
let _app: express.Application;
function expressApp() {
    if (_app != undefined) return _app;
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
    return app;
}

const publicRouter = express.Router();
const privateRouter = express.Router();

async function mountRoutes(ctrl: IController, prefix: string): Promise<void> {
    publicRouter.use(prefix, await ctrl.publicRoutes());
    privateRouter.use(prefix, await ctrl.privateRoutes());
}

async function setupRoutes(): Promise<void> {
    const app = expressApp();
    await mountRoutes(BrokerController, '/broker');
    await mountRoutes(TaskController, '/task');
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

async function startServer(): Promise<unknown> {
    // await setupGraphQL();
    await setupRoutes();
    const app = expressApp();
    app.use(handleError);
    const port = Config.get(HTTP_API_SERVER_PORT, 5000);
    return new Promise((resolve, reject) => {
        Log.info(`Starting server at 0.0.0.0:${port}`);
        app.listen(port, () => {
            displayRoutes(app);
            // resolve();
        }).on('error', (error) => {
            Log.error(error);
            reject(error);
        });
    });
}

export const APIService = {
    startServer,
};
