import express from 'express';
import { Service } from 'typedi';
import { Config } from '../config';
import { APIController } from '../lib/controller';

@Service()
export class APIServer {
    app: express.Express;

    publicRouter: express.Router;

    privateRouter: express.Router;

    constructor(private config: Config, private apiController: APIController) {
        this.app = express();
        this.publicRouter = express.Router();
        this.privateRouter = express.Router();
    }

    async setupRoutes(): Promise<void> {
        this.apiController.mountPublicRoutes(this.publicRouter);
        this.app.use('/api.public', this.publicRouter);
    }

    async start(): Promise<unknown> {
        await this.setupRoutes();
        return new Promise((resolve) => {
            const port = this.config.get('HTTP_API_PORT');
            this.app.listen(port, () => {
                console.log(`API server available at 0.0.0.0:${port}`);
                resolve();
            });
        });
    }
}
