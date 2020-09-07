import { Log } from '../infra';
import { TickConsumerService } from './consumer';
import { TickListenerService } from './publisher';

async function startTickListener(): Promise<void> {
    Log.info('Starting tick publisher...');
    await TickListenerService.start();
}
const { startRawTickConsumer, startTickStoreConsumer, startTickConsumer } = TickConsumerService;

export const TickService = {
    startTickListener,
    startRawTickConsumer,
    startTickStoreConsumer,
    startTickConsumer,
};
