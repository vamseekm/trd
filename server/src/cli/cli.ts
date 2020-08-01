import { Service } from 'typedi';

import { APIServer } from '../api-server';
import { LoggerService, MySQLService } from '../infra';
import { InstrumentService } from '../instrument';
import { TaskService } from '../task';

@Service()
export class Cli {
    constructor(
        private mysqlSvc: MySQLService,
        private apiServer: APIServer,
        private taskSvc: TaskService,
        private loggerSvc: LoggerService,
        private instrumentSvc: InstrumentService,
    ) {}

    async dbInit(): Promise<void> {
        await this.mysqlSvc.init();
    }

    async startAPIServer(): Promise<void> {
        this.loggerSvc.info('Starting API server ...');
        await this.apiServer.start();
    }

    async sync(): Promise<void> {
        this.loggerSvc.info(`Syncing instruments ...`);
        return this.taskSvc.sync();
    }

    async debug(): Promise<void> {
        this.loggerSvc.info(`Debug start ... `);
        //await this.instrumentSvc.trackInstruments();
        await this.taskSvc.sync();
        this.loggerSvc.info('Debug done..');
        // eslint-disable-next-line @typescript-eslint/no-empty-function
        return new Promise(() => {});
    }
}
