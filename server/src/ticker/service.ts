import { Log } from '../infra';
import { TickConsumerService } from './service/consumer';
import { TickListenerService } from './service/listener';

async function startTickListener(): Promise<void> {
    Log.info('Starting tick publisher...');
    await TickListenerService.start();
}

async function startRawTickConsumer(): Promise<void> {
    await TickConsumerService.startRawTickConsumer();
}

async function startTickStoreConsumer(): Promise<void> {
    await TickConsumerService.startTickStoreConsumer();
}

export const TickService = {
    startTickListener,
    startRawTickConsumer,
    startTickStoreConsumer,
};
