/* eslint-disable unicorn/no-null */
import plimit from 'p-limit';

import { BIND_TICKS, EX_TICKER, QUEUE_RAW_TICKS, QUEUE_STORE_TICKS } from '../bridge';
import { consumeFromQueue } from '../bridge';
import { CacheService } from '../cache';
import { Log } from '../infra';
import { ITick } from '../types';
import { TickRepository } from './repository';

async function startRawTickConsumer(): Promise<void> {
    const limit = plimit(32);
    await consumeFromQueue({ queueName: QUEUE_RAW_TICKS }, async ({ message, channel, statsUpdateCallback }) => {
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
            const processedTicks: ITick[] = ticks.map((tick: any): ITick => formatTick(tick));
            await channel.publish(
                EX_TICKER,
                BIND_TICKS,
                Buffer.from(JSON.stringify({ ticks: processedTicks, received_on })),
                {
                    persistent: true,
                },
            );
            statsUpdateCallback({ totalCount: ticks.length });
        }
        if (message) channel.ack(message);
    });
    return new Promise(() => {
        console.log('Starting tick consumer...');
    });
}

async function startTickStoreConsumer(): Promise<void> {
    await consumeFromQueue({ queueName: QUEUE_STORE_TICKS }, async ({ message, channel, statsUpdateCallback }) => {
        const content = JSON.parse(message.content.toString());
        const tickRows = content.ticks
            .filter((tick: ITick) => {
                return tick.timestamp != undefined;
            })
            .map((tick: ITick) => {
                const { timestamp, globalSymbol } = tick;
                return TickRepository.create({ timestamp, tickString: JSON.stringify(tick), globalSymbol });
            });
        await TickRepository.bulkInsert(tickRows);
        await channel.ack(message);
        statsUpdateCallback({ totalCount: tickRows.length });
    });
    return new Promise(() => {
        Log.info('Starting tick store consumer...');
    });
}

function formatTick(tick: any): ITick {
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
