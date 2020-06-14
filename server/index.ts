/* eslint-disable no-console */
import minimist from 'minimist';
import { start } from './api_server';

const argv = minimist(process.argv.slice(2));
console.log('ARGV: ', JSON.stringify(argv));

async function run() {
    if (argv['api-server']) {
        await start();
    }
}

(async function main() {
    try {
        await run();
    } catch (err) {
        console.log(err);
    }
})();
