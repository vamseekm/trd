import { consumeQueue, EXCHANGE_TICKER, MessageType } from '../bridge';
import { formatTick } from '../tick/util';
import { waitForever } from '../util';

export async function startTickRawConsumer(): Promise<void> {
    await consumeQueue({ name: 'rawTickConsumer', messageType: MessageType.rawTick }, async ({ message, channel }) => {
        const { ticks, received_on } = JSON.parse(message.content.toString());
        if (!ticks) return;
        const processedTicks = await Promise.all(ticks.map((tick: any) => formatTick(tick)));
        const validTicks = processedTicks.filter((tick) => !!tick);
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
    await waitForever();
}
