import { InstrumentService } from '../instrument';

async function cron(): Promise<void> {
    await InstrumentService.download();
    // await InstrumentService.updateMeta();
    await InstrumentService.updateLtpInitial();
    await InstrumentService.track();
    await InstrumentService.updateLTPTracked();
}

export const TaskService = {
    cron,
};
