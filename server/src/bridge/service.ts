import { Channel, ConsumeMessage } from 'amqplib';

import { Log, Rabbit } from '../infra';
import { printStats } from '../util';

type ConsumerArguments = { name: string; prefetch?: number; messageType: MessageType };
type ConsumerCallback = ({
    channel,
    message,
}: {
    channel: Channel;
    message: ConsumeMessage;
}) => Promise<number | boolean | undefined>;
export async function consumeQueue(
    { name, messageType, prefetch = 1 }: ConsumerArguments,
    callback: ConsumerCallback,
): Promise<void> {
    const stats = { items: 0, messages: 0, size: 0, ack: 0, error: 0 };
    const channel = await Rabbit.createChannel();
    await channel.assertExchange(EXCHANGE_TICKER, 'topic', { durable: true });
    await channel.assertQueue(name, { durable: true });
    await channel.bindQueue(name, EXCHANGE_TICKER, messageType);
    for (const messageType in MessageType) {
        await channel.assertQueue(`${messageType}Consumer`, { durable: true });
        await channel.bindQueue(`${messageType}Consumer`, EXCHANGE_TICKER, messageType);
    }
    await channel.prefetch(prefetch);
    await channel.consume(name, async (message: ConsumeMessage | null) => {
        if (message == undefined) return;
        try {
            const processedCount = await callback({
                message,
                channel,
            });
            if (processedCount === false) return;
            if (typeof processedCount === 'number') stats.items += processedCount || 0;
            channel.ack(message);
            stats.ack += 1;
            stats.size += message.content.length;
            stats.messages += 1;
        } catch (error) {
            console.error(error);
            stats.error += 1;
        }
    });
    setInterval(() => {
        // Log.json(`${name}`.padEnd(25), stats);
        printStats(name, { ...stats, size: `${(stats.size / (1024 * 1024)).toFixed(2)}M` });
        stats.items = 0;
        stats.messages = 0;
        stats.size = 0;
        stats.error = 0;
        stats.ack = 0;
    }, 10000);
}

export enum MessageType {
    rawTick = 'rawTick',
    tick = 'tick',
    candle = 'candle',
    orderUpdate = 'orderUpdate',
}

export const EXCHANGE_TICKER = 'ex.ticker';
