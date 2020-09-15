import { consumeQueue, MessageType } from '../../bridge';
import { ITick } from '../../types';
import { forever } from '../../util';

export async function startTickProcessConsumer(): Promise<void> {
    await consumeQueue({ name: 'tickConsumer', messageType: MessageType.tick }, async ({ message }) => {
        const { ticks }: { ticks: ITick[]; received_on: number } = JSON.parse(message.content.toString());
        if (!ticks) return 0;
        return false;
    });
    await forever();
}
