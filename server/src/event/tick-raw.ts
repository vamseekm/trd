import { BridgeService } from '../bridge';
import { TickUtil, waitForever } from '../util';

export async function startTickRawConsumer(): Promise<void> {
    await BridgeService.consumeQueue(
        { name: 'rawTickConsumer', messageType: BridgeService.MessageType.rawTick },
        async ({ message, channel }) => {
            const { ticks, received_on } = JSON.parse(message.content.toString());
            if (!ticks) return;
            const processedTicks = await Promise.all(ticks.map((tick: any) => TickUtil.formatTick(tick)));
            const validTicks = processedTicks.filter((tick) => !!tick);
            if (validTicks.length === 0) return 0;
            await channel.publish(
                BridgeService.EXCHANGE_TICKER,
                BridgeService.MessageType.tick,
                Buffer.from(JSON.stringify({ ticks: validTicks, received_on })),
                {
                    persistent: true,
                },
            );
            return validTicks.length;
        },
    );
    await waitForever();
}
