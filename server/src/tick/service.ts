import { DateTime } from 'luxon';

import { Log } from '../infrastructure';
import { TickRepository } from '../persistance';
async function clean(): Promise<void> {
    Log.info('Removing old ticks ...');
    const removeDataOlderThan = DateTime.local().minus({ day: 1 }).toJSDate();
    const count = await TickRepository.removeDataOlderThan(removeDataOlderThan);
    Log.info(`\tRemoved ${count} ticks.`);
    // Log.info(`\tVaccuming...`);
    // await DatabaseService.vaccume('public.tick');
}

export const TickService = {
    clean,
};
