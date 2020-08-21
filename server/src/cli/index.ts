/* eslint-disable @typescript-eslint/no-explicit-any */
import 'reflect-metadata';

import { exec } from 'child_process';
import { program } from 'commander';
import { exit } from 'process';
import { Container } from 'typedi';

import { logError, logInfo, rabbitSetup } from '../infra';
import { CliService } from './service';

async function clearPort(port: number) {
    return new Promise((resolve, reject) => {
        logInfo('Starting ...');
        logInfo(`Killing any processes holding port :${port} ...`);
        exec(`fuser -k ${port}/tcp; sleep 0.1 | exit 0`, (error, stdout, stderr) => {
            if (error) {
                if (error) logError(error);
                return reject(error);
            }
            if (stdout && stdout.length > 0) {
                logInfo('stdout: ');
                console.log(stdout);
            }
            if (stderr && stderr.length > 0) {
                logInfo('stderr: ');
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

    const cli = Container.get(CliService);
    await rabbitSetup();
    const actions: Promise<any>[] = [];
    await cli.dbInit();
    if (program.apiServer) {
        actions.push(clearPort(3000));
        actions.push(cli.startAPIServer());
    }
    if (program.sync) {
        actions.push(cli.sync());
    }
    if (program.debug) {
        actions.push(cli.debug());
    }
    if (program.tickListener) {
        actions.push(cli.startTickListener());
    }
    if (program.rawTickConsumer) {
        actions.push(cli.startRawTickConsumer());
    }
    if (program.tickStoreConsumer) {
        actions.push(cli.startTickStoreConsumer());
    }
    await Promise.all(actions);
    if (program.forceExit) {
        logInfo('force exiting ...');
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
        logError('error', error);
    } finally {
        const endTime = new Date().getTime();
        logInfo(`Action elapsed time: ${((endTime - startTime) / 1000).toFixed(3)} sec.`);
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
