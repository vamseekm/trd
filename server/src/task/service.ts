import { InstrumentService } from '../instrument';

async function init(): Promise<void> {
    await InstrumentService.download();
    // await InstrumentService.updateMeta();
    await InstrumentService.updateLtpInitial();
    await InstrumentService.track();
    await InstrumentService.updateLTPTracked();
}

async function cron(): Promise<void> {
    await InstrumentService.updateMeta();
}

export const TaskService = {
    init,
    cron,
};
