import { InstrumentService } from '../instrument';
import { TickService } from '../tick/service';
import nodeCron from 'node-cron';

async function init(): Promise<void> {
    await InstrumentService.download();
    // await InstrumentService.updateMeta();
    await InstrumentService.updateLtpInitial();
    await InstrumentService.track();
    await InstrumentService.updateLTPTracked();
}

async function cron(): Promise<void> {
    console.log('Running cron.');
    nodeCron.schedule('0 0 * * *', async function () {
        await InstrumentService.updateMeta();
        await TickService.backup();
        await TickService.clean();
        console.log('Done running cron.');
        process.exit(0);
    });
    return new Promise(() => {});
}

export const TaskService = {
    init,
    cron,
};
