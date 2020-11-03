import { InstrumentService } from '../instrument';
import { TickService } from '../tick/service';

async function init(): Promise<void> {
    await InstrumentService.download();
    // await InstrumentService.updateMeta();
    await InstrumentService.updateLtpInitial();
    await InstrumentService.track();
    await InstrumentService.updateLTPTracked();
}

async function cron(): Promise<void> {
    await InstrumentService.updateMeta();
    await TickService.backup();
    await TickService.clean();
}

export const TaskService = {
    init,
    cron,
};
