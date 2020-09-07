import { InstrumentService } from '../instrument';

async function sync(): Promise<void> {
    await InstrumentService.syncInstruments();
    await InstrumentService.updateLTPInitialInstruments();
    await InstrumentService.trackInstruments();
    await InstrumentService.updateLTPTrackedInstruments();
}

export const TaskService = {
    sync,
};
