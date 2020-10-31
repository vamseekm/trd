import amqplib, { Channel, Connection } from 'amqplib';

import { Config } from './config';
import { Log } from './logger';

let _connection: Connection | undefined;
let _channel: Channel | undefined;

async function connection(): Promise<Connection> {
    if (_connection != undefined) {
        return _connection;
    }
    Log.info(`Connecting to Rabbit...`);
    const conn = await amqplib.connect(Config.get('RABBIT_URL'));
    conn.on('error', (err) => {
        Log.error(err);
    });
    conn.on('close', () => {
        Log.info('Rabbit: closed');
        Log.info('Rabbit: Exiting process...');
        setTimeout(() => process.exit(0), 1000);
    });
    _connection = conn;
    return _connection;
}

export async function createChannel(): Promise<Channel> {
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
    const ch = await createChannel();
    await ch.assertExchange(exchange, 'topic', { durable: true });
    await ch.assertQueue(queue, { durable: true });
    await ch.bindQueue(queue, exchange, binding_key);
}

export const Rabbit = {
    createChannel,
    setupQueue,
};
