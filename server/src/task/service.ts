/* eslint-disable no-useless-constructor */
import { Service } from 'typedi';

import { InstrumentService } from '../instrument';
import { NSEService } from '../nse';

@Service()
export class TaskService {
    constructor(private instrumentSvc: InstrumentService, private nseSvc: NSEService) {}

    async sync(): Promise<void> {
        await this.instrumentSvc.syncInstruments();
        await this.nseSvc.syncMetaData();
    }
}
