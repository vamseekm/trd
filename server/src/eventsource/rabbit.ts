import amqplib, { Channel, Connection } from 'amqplib';

import { get } from '../infra/config';
import { Log } from '../infra/logger';

let _connection: Connection | undefined;
let _channel: Channel | undefined;

async function connection(): Promise<Connection> {
    if (_connection != undefined) {
        return _connection;
    }
    const RABBIT_URL = get('RABBIT_URL');
    Log.info(`Connecting to Rabbit(${RABBIT_URL})...`);
    _connection = await amqplib.connect(get('RABBIT_URL'));
    return _connection;
}

export async function channel(): Promise<Channel> {
    if (_channel != undefined) {
        return _channel;
    }
    _channel = await (await connection()).createChannel();
    return _channel;
}

async function setupQueue({
    exchange,
    queue,
    binding_key,
}: {
    exchange: string;
    queue: string;
    binding_key: string;
}): Promise<void> {
    const ch = await channel();
    await ch.assertExchange(exchange, 'topic', { durable: true });
    await ch.assertQueue(queue, { durable: true });
    await ch.bindQueue(queue, exchange, binding_key);
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
    await setupQueue({ exchange: EX_TICKER, queue: QUEUE_RAW_TICKS, binding_key: BIND_RAW_TICKS });
    await setupQueue({ exchange: EX_TICKER, queue: QUEUE_STORE_TICKS, binding_key: BIND_TICKS });
    await setupQueue({ exchange: EX_TICKER, queue: QUEUE_TICKS, binding_key: BIND_TICKS });
    await setupQueue({ exchange: EX_REPLAY, queue: QUEUE_TICKS, binding_key: BIND_TICKS });
    await setupQueue({ exchange: EX_TICKER, queue: QUEUE_ORDER, binding_key: BIND_ORDER });
    await setupQueue({ exchange: EX_REPLAY, queue: QUEUE_ORDER, binding_key: BIND_ORDER });
}

export const Rabbit = {
    setup: setupEventSource,
    channel,
};
