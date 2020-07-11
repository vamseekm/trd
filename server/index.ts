import 'reflect-metadata';

import { program } from 'commander';
import { Container } from 'typedi';
import moment from 'moment';
import { memoryUsage } from 'process';
import { Cli } from './cli';
import { Logger } from './infra/logger';

async function run() {
    program.option('-x --force-exit', 'Force exit');
    program.option('-a --api-server', 'Start API server.');
    program.option('-s --sync', 'Start debug main');
    program.option('-d --debug', 'Start debug main');
    program.parse(process.argv);
    const cli = Container.get(Cli);
    const logger = Container.get(Logger);
    cli.setup();
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
        logger.log('info', 'force exiting...');
        process.exit(0);
    }
}

(async function main() {
    const startTime = new Date().getTime();
    const logger = Container.get(Logger);
    try {
        await run();
        console.log('Action completed.');
    } catch (err) {
        logger.error('error', err);
    } finally {
        const endTime = new Date().getTime();
        logger.log('info', `Action elapsed time: ${((endTime - startTime) / 1000).toFixed(3)} sec.`);
    }
})();
