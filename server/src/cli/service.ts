import { APIServer } from '../api-server';
import { CandleService } from '../candle/service';
import { Database } from '../database';
import { ExchangeService } from '../exchange';
import { Log, mongoConnect } from '../infra';
import { InstrumentService } from '../instrument';
import { PrefService } from '../pref';
import { TaskService } from '../task';
import { TickService } from '../ticker';
import { forever } from '../util';

async function databaseInit(): Promise<void> {
    // await mongoConnect();
    await Database.connect();
}

async function startAPIServer(): Promise<void> {
    Log.info('Starting API server...');
    await APIServer.start();
}

async function sync(): Promise<void> {
    Log.info(`Syncing instruments...`);
    return TaskService.sync();
}

async function debug(): Promise<void> {
    Log.info(`Debug start... `);
    await PrefService.set('hello', 'word111');
    // console.time('hi');
    // console.log(await PrefService.get('hello'));
    // console.timeEnd('hi');
    // await InstrumentService.syncInstruments();
    // await InstrumentService.updateLTPInitialInstruments();
    await InstrumentService.trackInstruments();

    // await PrefService.set('hello', 'world');
    // await InstrumentService.syncInstruments();
    // await InstrumentService.updateLTPInitialInstruments();
    // await InstrumentService.trackInstruments();
    // await TaskService.sync();
    // await InstrumentService.debug();
    // await InstrumentService.updateLTPTrackedInstruments();
    // await CandleService.sync();
    // await InstrumentService.updateLTPAll();
    // await InstrumentService.getInstrumentsWithNoLastPrice();
    // Log.info('Debug done');
    // await ExchangeService.getExchangeTimes();
    // await forever();
}

const { startTickListener, startRawTickConsumer, startTickStoreConsumer, startTickConsumer } = TickService;

export const CliService = {
    databaseInit,
    startAPIServer,
    sync,
    debug,
    startTickListener,
    startRawTickConsumer,
    startTickStoreConsumer,
    startTickConsumer,
};
