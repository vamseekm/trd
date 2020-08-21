import { Service } from 'typedi';

import { APIServer } from '../api-server';
import { logInfo, mysqlConnect } from '../infra';
import { TaskService } from '../task';
import { TickService } from '../ticker';

@Service()
export class CliService {
    constructor(private apiServer: APIServer, private taskSvc: TaskService, private tickService: TickService) {}

    async dbInit(): Promise<void> {
        await mysqlConnect();
    }

    async startAPIServer(): Promise<void> {
        logInfo('Starting API server...');
        await this.apiServer.start();
    }

    async startTickListener(): Promise<void> {
        await this.tickService.startTickListener();
    }

    async startRawTickConsumer(): Promise<void> {
        await this.tickService.startRawTickConsumer();
    }

    async startTickStoreConsumer(): Promise<void> {
        await this.tickService.startTickStoreConsumer();
    }

    async sync(): Promise<void> {
        logInfo(`Syncing instruments...`);
        return this.taskSvc.sync();
    }

    async debug(): Promise<void> {
        logInfo(`Debug start... `);
        // await this.startTickStoreConsumer();
        // await this.tickService.startTickConsumer();
        // await this.tickService.startTickListener();
        // await this.taskSvc.sync();
        // await this.instrumentSvc.trackInstruments();
        // await this.instrumentSvc.trackInstruments();
        // await this.instrumentSvc.trackFnO();
        logInfo('Debug done');
        // eslint-disable-next-line @typescript-eslint/no-empty-function
        return new Promise(() => {});
    }
}
