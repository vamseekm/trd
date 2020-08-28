import { promises } from 'fs';
import { report } from 'process';
import { getRepository } from 'typeorm';

import { Log } from '../infra';
import { TickConsumerService } from './consumer';
import { Tick } from './entity';
import { TickListenerService } from './publisher';

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

async function fixTicks(): Promise<void> {
    const tickRepo = getRepository(Tick);
    let count = 0;
    while (true) {
        const rows = await tickRepo.createQueryBuilder().where({ globalSymbol: '' }).limit(1777).getMany();
        if (rows.length == 0) return;
        await Promise.all(
            rows.map((row) => {
                const { id } = row;
                const { globalSymbol } = JSON.parse(row.tickString);
                return tickRepo.update({ id }, { globalSymbol });
            }),
        );
        count += rows.length;
        Log.info(`Updated: ${count}`);
    }
    // if (row == undefined) return;
    // const { id, tickString } = row;
    // const { globalSymbol } = JSON.parse(tickString);
    // await tickRepo.update({ id }, { globalSymbol });
}

export const TickService = {
    startTickListener,
    startRawTickConsumer,
    startTickStoreConsumer,
    fixTicks,
};
