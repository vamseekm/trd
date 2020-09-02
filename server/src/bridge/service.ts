import { Channel, ConsumeMessage } from 'amqplib';

import { Log, Rabbit } from '../infra';

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
    const channel = await Rabbit.createChannel();
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

export const EX_TICKER = 'exchange_ticker';
export const EX_REPLAY = 'exchange_replay';
export const QUEUE_RAW_TICKS = 'queue_raw_ticks';
export const QUEUE_STORE_TICKS = 'queue_store_ticks';
export const QUEUE_ORDER = 'queue_order';
export const QUEUE_TICKS = 'queue_ticks';
export const BIND_RAW_TICKS = 'raw_ticks';
export const BIND_TICKS = 'ticks';
export const BIND_ORDER = 'order';

export async function setupEventSource(): Promise<void> {
    await Rabbit.setupQueue({ exchange: EX_TICKER, queue: QUEUE_RAW_TICKS, binding_key: BIND_RAW_TICKS });
    await Rabbit.setupQueue({ exchange: EX_TICKER, queue: QUEUE_STORE_TICKS, binding_key: BIND_TICKS });
    //await Rabbit.setupQueue({ exchange: EX_TICKER, queue: QUEUE_TICKS, binding_key: BIND_TICKS });
    //await Rabbit.setupQueue({ exchange: EX_REPLAY, queue: QUEUE_TICKS, binding_key: BIND_TICKS });
    await Rabbit.setupQueue({ exchange: EX_TICKER, queue: QUEUE_ORDER, binding_key: BIND_ORDER });
    await Rabbit.setupQueue({ exchange: EX_REPLAY, queue: QUEUE_ORDER, binding_key: BIND_ORDER });
}
