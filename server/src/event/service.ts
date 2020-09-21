import { startTickProcessConsumer } from './process-tick';
import { startTickListener } from './publisher';
import { startRawTickConsumer } from './raw-tick';
import { startTickStoreConsumer } from './store-tick';

export const EventService = {
    startTickProcessConsumer,
    startRawTickConsumer,
    startTickStoreConsumer,
    startTickListener,
};
