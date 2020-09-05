import { InstrumentService } from '../instrument';

async function sync(): Promise<void> {
    await InstrumentService.syncInstruments();
    await InstrumentService.updateLTPAll();
    await InstrumentService.trackInstruments();
}

export const TaskService = {
    sync,
};
