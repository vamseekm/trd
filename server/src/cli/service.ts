import { APIServer } from '../api-server';
import { Log, mongoConnect } from '../infra';
import { InstrumentService } from '../instrument';
import { TaskService } from '../task';
import { TickService } from '../ticker';
import { forever } from '../util';

async function databaseInit(): Promise<void> {
    await mongoConnect();
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
    // await PrefService.set('hello', 'world');
    // await InstrumentService.sync();
    // await TaskService.sync();
    // await CandleService.sync();
    await InstrumentService.syncInstruments();
    // Log.info('Debug done');
    await forever();
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
