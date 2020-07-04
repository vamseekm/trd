/* eslint-disable no-useless-constructor */
import { Service } from 'typedi';
import { APIServer } from './infra';

@Service()
export class Cli {
    constructor(private apiServer: APIServer) {}

    async startAPIServer(): Promise<void> {
        await this.apiServer.start();
    }
}
