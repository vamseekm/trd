/* eslint-disable no-useless-constructor */
import { from } from 'rxjs';
import { concatMap, toArray } from 'rxjs/operators';
import { Service } from 'typedi';

import { BrokerService } from '../broker';
import { LoggerService } from '../infra';
import { InstrumentService } from '../instrument';
import { NSEService } from '../nse';

@Service()
export class TaskService {
    constructor(private instrumentSvc: InstrumentService, private nseSvc: NSEService) { }

    async sync(): Promise<void> {
        await this.instrumentSvc.syncInstruments();
        await this.nseSvc.syncMetaData();
    }
}
