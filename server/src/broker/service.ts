import { Service } from 'typedi';

import { Config, LoggerService, Redis } from '../infra';
import { InstrumentService } from '../instrument';
import { PrefService } from '../pref';
import { KiteService } from './kite';

@Service()
export class BrokerService extends KiteService {
    constructor(
        public config: Config,
        public instrumentSvc: InstrumentService,
        public redis: Redis,
        public logger: LoggerService,
        public prefSvc: PrefService,
    ) {
        super();
    }
}
