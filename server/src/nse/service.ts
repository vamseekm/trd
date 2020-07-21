import { Service } from 'typedi';

import { InstrumentService } from '../instrument';

@Service()
export class NSEService {
    constructor(private instrumentSvc: InstrumentService) { }

    async syncMetaData() { }
}
