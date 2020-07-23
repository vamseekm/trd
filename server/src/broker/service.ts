import { Service } from 'typedi';

import { Config, LoggerService, Redis } from '../infra';
import { PrefService } from '../pref';
import { KiteService } from './kite';

@Service()
export class BrokerService extends KiteService {
    constructor(public config: Config, public redis: Redis, public logger: LoggerService, public prefSvc: PrefService) {
        super();
    }
}
