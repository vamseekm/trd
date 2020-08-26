/* eslint-disable @typescript-eslint/no-explicit-any */
import 'reflect-metadata';

import { exec } from 'child_process';
import { program } from 'commander';
import { exit } from 'process';

import { setupEventSource } from '../eventsource';
import { Log } from '../infra';
import { CliService } from './service';

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

async function run() {
    program.option('-x --force-exit', 'Force exit');
    program.option('-a --api-server', 'Start API server.');
    program.option('-s --sync', 'Cron sync.');
    program.option('-d --debug', 'Start debug main.');
    program.option('-t --tick-listener', 'Listen for raw ticks');
    program.option('--raw-tick-consumer', 'Consume raw ticks');
    program.option('--tick-store-consumer', 'Start tick store.');
    program.parse(process.argv);

    await setupEventSource();
    const actions: Promise<any>[] = [];
    await CliService.databaseInit();
    if (program.apiServer) {
        actions.push(clearPort(3000));
        actions.push(CliService.startAPIServer());
    }
    if (program.sync) {
        actions.push(CliService.sync());
    }
    if (program.debug) {
        actions.push(CliService.debug());
    }
    if (program.tickListener) {
        actions.push(CliService.startTickListener());
    }
    if (program.rawTickConsumer) {
        actions.push(CliService.startRawTickConsumer());
    }
    if (program.tickStoreConsumer) {
        actions.push(CliService.startTickStoreConsumer());
    }
    await Promise.all(actions);
    if (program.forceExit) {
        Log.info('force exiting ...');
        // eslint-disable-next-line unicorn/no-process-exit
        process.exit(0);
    }
}

(async function main() {
    const startTime = new Date().getTime();
    try {
        await run();
        console.log('Action completed.');
    } catch (error) {
        Log.error('error', error);
    } finally {
        const endTime = new Date().getTime();
        Log.info(`Action elapsed time: ${((endTime - startTime) / 1000).toFixed(3)} sec.`);
    }
})();

function cleanHandler(type: string) {
    return function handleExit(cause: any) {
        console.log(`Exiting with cause [${type}]: ${JSON.stringify(cause, undefined, 2)}`);
        if (cause.stack) console.log(cause.stack);
        exit(0);
    };
}

function handleRejection(error: any, promise: any) {
    console.error('unhandled promise rejection:', '\nerr:', error, '\npromise:', promise);
    if (error && error.stack) {
        console.error('stack:', error.stack);
    }
}

process.on('unhandledRejection', handleRejection);
process.on('SIGINT', cleanHandler('SIGINT'));
process.on('SIGTERM', cleanHandler('SIGTERM'));
process.on('SIGUSR2', cleanHandler('SIGUSR2'));
