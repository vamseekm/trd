import 'reflect-metadata';
import { program } from 'commander';
import { Container } from 'typedi';
import { Cli } from './cli';

async function run() {
    program.option('-a --api-server', 'Start API server.');
    program.option('-s --sync', 'Start debug main');
    program.option('-d --debug', 'Start debug main');
    program.parse(process.argv);
    const cli = Container.get(Cli);
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
}

(async function main() {
    const startTime = new Date().getTime();
    try {
        await run();
    } catch (err) {
        console.error(err);
    } finally {
        const endTime = new Date().getTime();
        console.log(`Action elapsed time: ${((endTime - startTime) / 1000).toFixed(3)} sec.`);
    }
})();
