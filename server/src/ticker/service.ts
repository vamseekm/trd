import { Service } from 'typedi';

import { logInfo } from '../infra';
import { TickConsumerService } from './service/consumer';
import { TickListenerService } from './service/listener';

@Service()
export class TickService {
    constructor(private tickPublisherService: TickListenerService, private tickConsumerSvc: TickConsumerService) {}
    async startTickListener(): Promise<void> {
        logInfo('Starting tick publisher...');
        await this.tickPublisherService.start();
    }
    async startRawTickConsumer(): Promise<void> {
        await this.tickConsumerSvc.startRawTickConsumer();
    }

    async startTickStoreConsumer(): Promise<void> {
        await this.tickConsumerSvc.startTickStoreConsumer();
    }
}
