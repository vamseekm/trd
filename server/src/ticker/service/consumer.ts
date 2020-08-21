/* eslint-disable unicorn/no-null */
import { ConsumeMessage } from 'amqplib';
import plimit from 'p-limit';

import { CacheService } from '../../cache';
import { Log, Rabbit } from '../../infra';
import { TickRepository } from '../repository';

async function startRawTickConsumer(): Promise<void> {
    const stats = { totalCount: 0 };
    const limit = plimit(32);
    const channel = await Rabbit.channel();
    channel.prefetch(1);
    channel.consume('tick_raw_queue', async (message: ConsumeMessage | null) => {
        if (message === null) return;
        const { ticks, received_on } = JSON.parse(message.content.toString());
        if (ticks) {
            await Promise.all(
                ticks.map((tick: any) => {
                    return limit(async () => {
                        const instrumentToken = tick.instrument_token;
                        const instrument = await CacheService.getInstrumentByToken(instrumentToken);
                        if (instrument == null)
                            throw new Error(`No instrument found with instrumentToken: ${instrumentToken}`);
                        tick.globalSymbol = instrument.globalSymbol;
                    });
                }),
            );
            stats.totalCount += ticks.length;
        }
        if (ticks) {
            const processedTicks = ticks.map((tick: any) => formatTick(tick));
            await channel.publish(
                'ticker_ex',
                'tick',
                Buffer.from(JSON.stringify({ ticks: processedTicks, received_on })),
                {
                    persistent: true,
                },
            );
        }
        if (message) channel.ack(message);
    });

    setInterval(() => {
        Log.json('Raw ticks processed', stats);
        stats.totalCount = 0;
    }, 10000);
    return new Promise(() => {
        console.log('Starting tick consumer...');
    });
}

async function startTickStoreConsumer(): Promise<void> {
    const channel = await Rabbit.channel();
    channel.prefetch(1);
    const stats = { totalTicks: 0, messagesProcessed: 0 };
    channel.consume('store', async (message: ConsumeMessage | null) => {
        if (message == null) return;
        const content = JSON.parse(message.content.toString());
        const tickRows = content.ticks
            .filter((tick: any) => {
                return tick.timestamp != undefined;
            })
            .map((tick: any) => {
                const { timestamp } = tick;
                return TickRepository.create({ timestamp, tickString: JSON.stringify(tick) });
            });
        await TickRepository.bulkInsert(tickRows);
        await channel.ack(message);
        stats.totalTicks += tickRows.length;
        stats.messagesProcessed += 1;
    });
    setInterval(() => {
        Log.json('Ticks stored', stats);
        stats.totalTicks = 0;
        stats.messagesProcessed = 0;
    }, 10000);
    return new Promise(() => {
        Log.info('Starting tick store consumer...');
    });
}

function formatTick(tick: any) {
    const {
        globalSymbol,
        last_price,
        volume,
        buy_quantity,
        sell_quantity,
        timestamp,
        last_trade_time,
        oi,
        depth,
        ...rest
    } = tick;
    return {
        globalSymbol,
        lastTradedPrice: last_price,
        totalVolume: volume,
        totalBuyQuantity: buy_quantity,
        totalSellQuantity: sell_quantity,
        timestamp: new Date(timestamp).getTime() / 1000,
        lastTradeTimestamp: new Date(last_trade_time).getTime() / 1000,
        openInterest: oi,
        depth,
    };
}

export const TickConsumerService = {
    startRawTickConsumer,
    startTickStoreConsumer,
};
