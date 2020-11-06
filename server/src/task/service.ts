import nodeCron from 'node-cron';

import { Log } from '../infrastructure';
import { InstrumentService } from '../instrument';
import { TickService } from '../tick/service';
import { waitForever } from '../util/lib/algo-ds';

async function init(): Promise<void> {
    await InstrumentService.download();
    // await InstrumentService.updateMeta();
    await InstrumentService.updateLtpInitial();
    await InstrumentService.track();
    await InstrumentService.updateLTPTracked();
}

async function cron(): Promise<any> {
    void (async function () {
        Log.info('Running in void');
    })();
    Log.info('Wating for cron to kick in...');
    nodeCron.schedule('0 0 * * *', function () {
        void (async function () {
            Log.info('Cron job started...');
            await InstrumentService.updateMeta();
            await TickService.backup();
            await TickService.clean();
            Log.info('Done running cron.');
            process.exit(0);
        })();
    });
    await waitForever();
}

export const TaskService = {
    init,
    cron,
};
