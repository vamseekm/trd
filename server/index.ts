import 'reflect-metadata';
import { program } from 'commander';
import { Container } from 'typedi';
import { Cli } from './cli';

async function run() {
    program.option('-a --api-server', 'Start API server.');
    program.option('-d --debug', 'Start debug main');
    program.parse(process.argv);
    const cli = Container.get(Cli);
    if (program.apiServer) {
        await cli.dbInit();
        await cli.startAPIServer();
    } else if (program.debug) {
        await cli.dbInit();
        await cli.debug();
    }
}

(async function main() {
    try {
        await run();
    } catch (err) {
        console.log(err);
    }
})();
