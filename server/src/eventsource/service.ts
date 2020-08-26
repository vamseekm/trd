import { Channel, ConsumeMessage } from 'amqplib';

import { Log } from '../infra';
import { Rabbit } from './rabbit';

type ConsumerArgs = { queueName: string; prefetch?: number };
interface StatsUpdateCallback {
    ({ totalCount }: { totalCount?: number }): void;
}
interface ConsumerCallback {
    ({
        channel,
        message,
        statsUpdateCallback: statsCallback,
    }: {
        channel: Channel;
        message: ConsumeMessage;
        statsUpdateCallback: StatsUpdateCallback;
    }): Promise<void>;
}

export async function consumeFromQueue(
    { queueName, prefetch = 1 }: ConsumerArgs,
    callback: ConsumerCallback,
): Promise<void> {
    const stats = { totalCount: 0, totalMessages: 0, totalSize: 0 };
    function statsUpdateCallback({ totalCount = 0 }: { totalCount?: number }) {
        stats.totalCount += totalCount;
    }
    const channel = await Rabbit.channel();
    channel.prefetch(prefetch);
    channel.consume(queueName, (message: ConsumeMessage | null) => {
        if (message == undefined) return;
        callback({
            channel,
            message,
            statsUpdateCallback,
        });
        stats.totalSize += message.content.length;
        stats.totalMessages += 1;
    });
    setInterval(() => {
        Log.json(`Queue stats: ${queueName}`, stats);
        stats.totalCount = 0;
        stats.totalMessages = 0;
        stats.totalSize = 0;
    }, 10000);
}
