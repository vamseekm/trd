import 'reflect-metadata';
import { program } from 'commander';
import { Container } from 'typedi';
import { Cli } from './cli';

async function run() {
    program.option('-a --api-server', 'Start API server.');
    program.parse(process.argv);
    const cli = Container.get(Cli);
    if (program.apiServer) {
        await cli.startAPIServer();
    }
}

(async function main() {
    try {
        await run();
    } catch (err) {
        console.log(err);
    }
})();
