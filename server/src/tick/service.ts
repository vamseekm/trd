import { DateTime } from 'luxon';

import { Log } from '../infra';
import { startRawTickConsumer, startTickProcessConsumer, startTickStoreConsumer } from './consumer';
import { startTickListener } from './publisher';
import { TickRepository } from './repository';
async function removeOldTicks(): Promise<void> {
    console.log('Removing old ticks ...');
    const removeDataOlderThan = DateTime.local().minus({ day: 1 }).toJSDate();
    const count = await TickRepository.removeDataOlderThan(removeDataOlderThan);
    Log.info(`\tRemoved ${count} ticks.`);
}

export const TickService = {
    removeOldTicks,
    startTickListener,
    startRawTickConsumer,
    startTickProcessConsumer,
    startTickStoreConsumer,
};
