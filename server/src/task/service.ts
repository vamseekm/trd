import { InstrumentService } from '../instrument';

async function startCron(): Promise<void> {
    await InstrumentService.syncInstruments();
    await InstrumentService.updateMeta();
    await InstrumentService.updateLTPInitialInstruments();
    await InstrumentService.trackInstruments();
    await InstrumentService.updateLTPTrackedInstruments();
}

export const TaskService = {
    startCron,
};
