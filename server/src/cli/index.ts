import 'reflect-metadata';

import { exec } from 'child_process';
import { program } from 'commander';
import { exit } from 'process';
import { Container } from 'typedi';

import { LoggerService } from '../infra';
import { Cli } from './cli';

async function clearPort(port: number) {
    const logger = Container.get(LoggerService);
    return new Promise((resolve, reject) => {
        logger.info(`Killing any processes holding port :${port} ...`);
        exec(`fuser -k ${port}/tcp | exit 0`, (error, stdout, stderr) => {
            if (error) {
                if (error) logger.error(error);
                return reject(error);
            }
            if (stdout && stdout.length > 0) logger.info('stdout: ', stdout);
            if (stderr && stderr.length > 0) logger.info('stderr: ', stderr);
            return resolve({ stdout, stderr });
        });
    });
}

async function run() {
    program.option('-x --force-exit', 'Force exit');
    program.option('-a --api-server', 'Start API server.');
    program.option('-s --sync', 'Start debug main');
    program.option('-d --debug', 'Start debug main');
    program.parse(process.argv);
    const cli = Container.get(Cli);
    const logger = Container.get(LoggerService);

    try {
        await clearPort(3000);
    } catch (error) {
        logger.error(error);
    }

    if (program.apiServer) {
        await cli.dbInit();
        await cli.startAPIServer();
    } else if (program.sync) {
        await cli.dbInit();
        await cli.sync();
    } else if (program.debug) {
        await cli.dbInit();
        await cli.debug();
    }
    if (program.forceExit) {
        logger.log('info', 'force exiting ...');
        // eslint-disable-next-line unicorn/no-process-exit
        process.exit(0);
    }
    console.log('hi');
}

(async function main() {
    const startTime = new Date().getTime();
    const logger = Container.get(LoggerService);
    try {
        await run();
        console.log('Action completed.');
    } catch (error) {
        logger.error('error', error);
    } finally {
        const endTime = new Date().getTime();
        logger.log('info', `Action elapsed time: ${((endTime - startTime) / 1000).toFixed(3)} sec.`);
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
