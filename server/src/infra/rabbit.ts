import amqplib, { Channel, Connection } from 'amqplib';

import { configGet } from './config';
import { logInfo } from './logger';

let _connection: Connection | undefined;
let _channel: Channel | undefined;

async function connection(): Promise<Connection> {
    if (_connection != undefined) {
        return _connection;
    }
    const RABBIT_URL = configGet('RABBIT_URL');
    logInfo(`Connecting to Rabbit(${RABBIT_URL})...`);
    _connection = await amqplib.connect(configGet('RABBIT_URL'));
    return _connection;
}

export async function rabbitChannel(): Promise<Channel> {
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
    const ch = await rabbitChannel();
    await ch.assertExchange(exchange, 'topic', { durable: true });
    await ch.assertQueue(queue, { durable: true });
    await ch.bindQueue(queue, exchange, binding_key);
}

export async function rabbitSetup(): Promise<void> {
    await setupQueue({ exchange: 'ticker_ex', queue: 'tick_raw_queue', binding_key: 'tick_raw' });
    await setupQueue({ exchange: 'ticker_ex', queue: 'order_update_queue', binding_key: 'order_update' });
    await setupQueue({ exchange: 'ticker_ex', queue: 'tick_queue', binding_key: 'tick' });
    await setupQueue({ exchange: 'ticker_ex', queue: 'store', binding_key: 'tick' });
    await setupQueue({ exchange: 'replay_ex', queue: 'tick_queue', binding_key: 'tick' });
    await setupQueue({ exchange: 'replay_ex', queue: 'order_update_queue', binding_key: 'order_update' });
}
