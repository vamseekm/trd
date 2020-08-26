import { APIServer } from '../api-server';
import { Log, MySQL } from '../infra';
import { TaskService } from '../task';
import { TickService } from '../ticker';

async function databaseInit(): Promise<void> {
    await MySQL.connect();
}

async function startAPIServer(): Promise<void> {
    Log.info('Starting API server...');
    await APIServer.start();
}

async function startTickListener(): Promise<void> {
    await TickService.startTickListener();
}

async function startRawTickConsumer(): Promise<void> {
    await TickService.startRawTickConsumer();
}

async function startTickStoreConsumer(): Promise<void> {
    await TickService.startTickStoreConsumer();
}

async function sync(): Promise<void> {
    Log.info(`Syncing instruments...`);
    return TaskService.sync();
}

async function debug(): Promise<void> {
    Log.info(`Debug start... `);
    // await startTickStoreConsumer();
    // await TickService.startTickConsumer();
    // await TickService.startTickListener();
    // await this.taskSvc.sync();
    // await InstrumentService.trackInstruments();
    // await InstrumentService.trackInstruments();
    // await InstrumentService.trackFnO();
    Log.info('Debug done');
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    return new Promise(() => {});
}

export const CliService = {
    databaseInit,
    startAPIServer,
    sync,
    debug,
    startTickListener,
    startRawTickConsumer,
    startTickStoreConsumer,
};
