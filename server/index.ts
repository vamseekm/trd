import 'reflect-metadata';
import { program } from 'commander';
import { Container } from 'typedi';
import { Cli } from './cli';

program.option('-a --api-server', 'Start API server.');
program.parse(process.argv);
async function run() {
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
