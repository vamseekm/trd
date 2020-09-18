import { DateTime } from 'luxon';

import { Log } from '../infra';
import { TickRepository } from './repository';
async function clean(): Promise<void> {
    console.log('Cleaning ticker...');
    const removeDataOlderThan = DateTime.local().minus({ day: 1 }).toJSDate();
    const count = await TickRepository.removeDataOlderThan(removeDataOlderThan);
    Log.info(`\tRemoved ${count} ticks.`);
}

export const TickerService = {
    clean,
};
