/* eslint-disable @typescript-eslint/no-explicit-any */
import 'reflect-metadata';

import { exec } from 'child_process';
import minimist from 'minimist';
import { exit } from 'process';
import { addScopeOptions } from 'sequelize-typescript';

import { APIService } from '../api-server/service';
import { CandleService } from '../candle';
import { DatabaseService } from '../database/service';
import { Log } from '../infra';
import { InstrumentService } from '../instrument/service/instrument';
import { TaskService } from '../task';
import { TickService } from '../tick';
import { waitForever } from '../util';

async function clearPort(port: number) {
    return new Promise((resolve, reject) => {
        Log.info('Starting ...');
        Log.info(`Killing any processes holding port :${port} ...`);
        exec(`fuser -k ${port}/tcp; sleep 0.1 | exit 0`, (error, stdout, stderr) => {
            if (error) {
                if (error) Log.error(error);
                return reject(error);
            }
            if (stdout && stdout.length > 0) {
                Log.info('stdout: ');
                console.log(stdout);
            }
            if (stderr && stderr.length > 0) {
                Log.info('stderr: ');
                console.log(stderr);
            }
            return resolve({ stdout, stderr });
        });
    });
}

async function run(): Promise<void> {
    console.log(process.cwd());
    const argv = minimist(process.argv.slice(2));
    Log.json('Args', argv);
    const entryModules: Record<string, any> = {
        APIService,
        CandleService,
        InstrumentService,
        TaskService,
        TickService,
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
        if (actionMap[option] == undefined) throw new Error(`Action "${option}" not found.`);
        actions.push(actionMap[option]);
    }
    await DatabaseService.databaseConnect();
    Log.info(`Executing ${actions.length} actions.`);
    if (actions.length > 0) await Promise.all(actions.map((a) => a()));
    if (argv['force-exit']) {
        Log.info('force exiting ...');
        // eslint-disable-next-line unicorn/no-process-exit
        process.exit(0);
    }
}

(async function main() {
    const startTime = new Date().getTime();
    try {
        await run();
        Log.info('Action completed.');
    } catch (error) {
        Log.error('Error:', error);
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
