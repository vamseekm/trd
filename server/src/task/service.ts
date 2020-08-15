/* eslint-disable no-useless-constructor */
import { Service } from 'typedi';

import { InstrumentMetaService, InstrumentService } from '../instrument';

@Service()
export class TaskService {
    constructor(private instrumentSvc: InstrumentService, private instrumentMetaSvc: InstrumentMetaService) {}

    async sync(): Promise<void> {
        await this.instrumentSvc.syncInstruments();
        await this.instrumentSvc.syncMetaData();
        await this.instrumentSvc.updateRanks();
        await this.instrumentSvc.updateLTPAll();
        await this.instrumentSvc.trackInstruments();
    }
}
