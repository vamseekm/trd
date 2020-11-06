/* eslint-disable @typescript-eslint/no-explicit-any */
import 'reflect-metadata';

import { Settings } from 'luxon';
import minimist from 'minimist';
import { exit } from 'process';

import { APIService } from '../api';
import { CandleService } from '../candle';
import { BridgeService, EventService } from '../event';
import { Log } from '../infrastructure';
import { InstrumentService } from '../instrument';
import { DatabaseService } from '../persistance';
import { TaskService } from '../task';
import { TickService } from '../tick';
import { waitForever } from '../util';

Settings.defaultZoneName = 'Asia/Calcutta';

async function run(): Promise<void> {
    await BridgeService.init();
    await DatabaseService.connect();
    const argv = minimist(process.argv.slice(2));
    Log.json('Args', argv);
    const entryModules: Record<string, any> = {
        APIService,
        CandleService,
        DatabaseService,
        InstrumentService,
        TaskService,
        TickService,
        EventService,
    };
    const actionMap: Record<string, any> = {};
    for (const moduleName of Object.keys(entryModules)) {
        const entryModule = entryModules[moduleName];
        for (const actionName of Object.keys(entryModule)) {
            // if (!actionName.startsWith('start')) continue;
            if (entryModule[actionName].length > 0) continue;
            const entryPointName = `${moduleName}::${actionName}`.replace('Service::', '::');
            actionMap[entryPointName] = entryModule[actionName].bind(entryModule);
        }
    }
    Log.info('Available entry points:');
    Object.keys(actionMap).map((key: string) => Log.info(`\t => ${key}`));
    if (argv.help === true) {
        await waitForever();
        return;
    }
    const actions: any[] = [];
    for (const option of Object.keys(argv)) {
        if (option == '_') continue;
        if (option.indexOf('::') === -1) continue;
        if (actionMap[option] == undefined) new Error(`Action "${option}" not found.`);
        actions.push(actionMap[option]);
    }
    Log.info(`Executing ${actions.length} actions.`);
    if (actions.length > 0) await Promise.all(actions.map((a) => a()));
    if (argv['force-exit']) {
        Log.info('force exiting ...');
        process.exit(0);
    }
}

void (async function main() {
    const startTime = new Date().getTime();
    try {
        await run();
        Log.info('Action completed.');
    } catch (error) {
        console.trace(error);
        Log.error(error);
    } finally {
        const endTime = new Date().getTime();
        Log.info(`Action elapsed time: ${((endTime - startTime) / 1000).toFixed(3)} sec.`);
    }
})();

function signalHandler(type: string) {
    return function handleExit(cause: any) {
        console.log(`Exiting with cause [${type}]: ${JSON.stringify(cause, undefined, 2)}`);
        if (cause.stack) console.log(cause.stack);
        exit(0);
    };
}

process.on('SIGINT', signalHandler('SIGINT'));
process.on('SIGTERM', signalHandler('SIGTERM'));
process.on('SIGUSR2', signalHandler('SIGUSR2'));

process.on('unhandledRejection', function (error: any, promise: any) {
    console.error('unhandled promise rejection:', '\nerr:', error, '\npromise:', promise);
    if (error && error.stack) {
        console.error(error.stack);
    }
});

process.on('uncaughtException', function (error: Error) {
    if (error) {
        console.log('uncaught exception:', error.message, error.stack);
    }
});
