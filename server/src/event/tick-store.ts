import { BridgeService } from '../bridge';
import { TickRepository } from '../database';
import { Log } from '../infra';
import { Tick } from '../types';

export async function startTickStoreConsumer(): Promise<void> {
    await BridgeService.consumeQueue(
        { name: 'tickStoreConsumer', messageType: BridgeService.MessageType.tick },
        async ({ message }) => {
            const { ticks }: { ticks: Tick[]; received_on: number } = JSON.parse(message.content.toString());
            if (!ticks) return 0;
            await TickRepository.bulkInsert(ticks);
            return ticks.length;
        },
    );
    return new Promise(() => {
        Log.info('Starting tick store consumer...');
    });
}
