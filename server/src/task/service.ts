import fs from 'fs';
import nodeCron from 'node-cron';
import path from 'path';
import pup from 'puppeteer';

import { BrokerService } from '../broker/service';
import { CandleService } from '../candle/service';
import { Log } from '../infrastructure';
import { InstrumentService } from '../instrument';
import { PrefRepository } from '../persistance';
import { TickService } from '../tick/service';
import { KITE_ACCESS_TOKEN } from '../types';
import { maskString, waitForever } from '../util/lib/algo-ds';

async function init(): Promise<void> {
    await InstrumentService.download();
    await InstrumentService.updateLtpInitial();
    await InstrumentService.track();
    await InstrumentService.updateLTPTracked();
}

async function runCronTasks(): Promise<any> {
    await init();
    await InstrumentService.updateMeta();
    await TickService.backup();
    await TickService.clean();
    await CandleService.flushCandleCache();
    await CandleService.loadCandles();
}

async function cron(): Promise<any> {
    void (async function () {
        Log.info('Running in void');
    })();
    Log.info('Wating for cron to kick in...');
    nodeCron.schedule('0 0 * * *', function () {
        void (async function () {
            Log.info('Cron job started...');
            await runCronTasks();
            Log.info('Done running cron.');
            process.exit(0);
        })();
    });
    await waitForever();
}

async function autoLogin(): Promise<void> {
    try {
        const profile = await BrokerService.getProfile();
        if (profile && typeof profile.name === 'string') {
            Log.info('Already logged in...');
            return;
        }
        console.log('Profile:', profile);
    } catch (err) {
        console.error(err);
    }
    console.log('Auto login...');
    const kiteConfigPath = path.join(process.cwd(), '../../config/kite.config.json');
    if (!fs.existsSync(kiteConfigPath)) throw new Error(`Can't find kite config file: ${kiteConfigPath}`);
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { user, password, pin } = require(kiteConfigPath);
    const browser = await pup.launch();
    const page = await browser.newPage();
    await page.setViewport({ width: 1024, height: 768 });
    Log.info('Opening login page...');
    await page.goto('https://trd.local/api/open/broker/login', { waitUntil: 'networkidle0' });
    Log.info('Filling user info...');
    await page.type('#userid', user);
    await page.type('#password', password);
    await page.click("button[type='submit']");
    Log.info('Clicked submit.');
    Log.info('Waiting for navigation...');
    try {
        await page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 10 * 1000 });
    } catch (err) {
        console.log(err);
    }
    Log.info('Filling PIN...');
    await page.type('#pin', pin);
    await page.click("button[type='submit']");
    Log.info('Clicked submit.');
    Log.info('Waiting for navigation...');
    try {
        await page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 10 * 1000 });
    } catch (err) {
        console.log(err);
    }
    Log.info('Got access token: ', maskString((await PrefRepository.get(KITE_ACCESS_TOKEN, '')) || ''));
    Log.info('Done');
    await browser.close();
}

async function autoLoginCron() {
    nodeCron.schedule('*/5 * * * *', function () {
        void (async function () {
            Log.info('Cron job started...');
            await runCronTasks();
            Log.info('Done running cron.');
            process.exit(0);
        })();
    });
    await waitForever();
}

export const TaskService = {
    init,
    runCronTasks,
    autoLogin,
    autoLoginCron,
    cron,
};
