import { Service } from 'typedi';
import { KiteService } from './kite';
import { Config, Redis, Logger } from '../infra';
import { InstrumentService } from '../instrument';
import { PrefService } from '../pref';

@Service()
export class BrokerService extends KiteService {
    constructor(
        public config: Config,
        public instrumentSvc: InstrumentService,
        public redis: Redis,
        public logger: Logger,
        public prefSvc: PrefService,
    ) {
        super();
    }
}
