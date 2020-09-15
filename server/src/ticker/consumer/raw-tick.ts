import { consumeQueue, EXCHANGE_TICKER, MessageType } from '../../bridge';
import { forever } from '../../util';
import { formatTick } from '../util';

export async function startRawTickConsumer(): Promise<void> {
    await consumeQueue({ name: 'rawTickConsumer', messageType: MessageType.rawTick }, async ({ message, channel }) => {
        const { ticks, received_on } = JSON.parse(message.content.toString());
        if (!ticks) return;
        const processedTicks = await Promise.all(ticks.map((tick: any) => formatTick(tick)));
        const validTicks = processedTicks.filter((tick) => !!tick);
        if (validTicks.length === 0) return 0;
        await channel.publish(
            EXCHANGE_TICKER,
            MessageType.tick,
            Buffer.from(JSON.stringify({ ticks: validTicks, received_on })),
            {
                persistent: true,
            },
        );
        return validTicks.length;
    });
    await forever();
}
