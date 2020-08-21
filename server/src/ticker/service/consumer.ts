/* eslint-disable unicorn/no-null */
import { ConsumeMessage } from 'amqplib';
import plimit from 'p-limit';
import { Service } from 'typedi';

import { CacheService } from '../../cache';
import { logInfo, logJson, rabbitChannel } from '../../infra';
import { TickRepository } from '../repository';

@Service()
export class TickConsumerService {
    constructor(private cacheSvc: CacheService, private tickRepo: TickRepository) {}
    async startRawTickConsumer(): Promise<void> {
        console.log('Constuemr listening');
        // const sc = await this.rabbitSvc.nats('tick_consume');
        // const sub = sc.subscribe('ticks', sc.subscriptionOptions().setStartWithLastReceived());
        const stats = { totalCount: 0 };
        const limit = plimit(32);
        const channel = await rabbitChannel();
        channel.prefetch(1);
        channel.consume('tick_raw_queue', async (message: ConsumeMessage | null) => {
            if (message === null) return;
            const { ticks, received_on } = JSON.parse(message.content.toString());
            if (ticks) {
                await Promise.all(
                    ticks.map((tick: any) => {
                        return limit(async () => {
                            const instrumentToken = tick.instrument_token;
                            const instrument = await this.cacheSvc.getInstrumentByToken(instrumentToken);
                            if (instrument == null)
                                throw new Error(`No instrument found with instrumentToken: ${instrumentToken}`);
                            tick.globalSymbol = instrument.globalSymbol;
                        });
                    }),
                );
                stats.totalCount += ticks.length;
            }
            if (ticks) {
                const processedTicks = ticks.map((tick: any) => this.formatTick(tick));
                await channel.publish(
                    'ticker_ex',
                    'tick',
                    Buffer.from(JSON.stringify({ ticks: processedTicks, received_on })),
                    {
                        persistent: true,
                    },
                );
            }
            // if (ticks[0].timestamp) {
            //     const time = new Date(ticks[0].timestamp);
            //     const lag = new Date().getTime() - time.getTime();
            //     logInfo(`Lag: ${lag}`);
            // }
            // if (received_on) {
            //     logInfo(`Rabbit Received lag: ${new Date().getTime() - received_on}`);
            // }
            if (message) channel.ack(message);
        });

        setInterval(() => {
            logJson('Raw ticks processed:', stats);
            stats.totalCount = 0;
        }, 10000);
        return new Promise(() => {
            console.log('Starting tick consumer...');
        });
    }

    async startTickStoreConsumer(): Promise<void> {
        const channel = await rabbitChannel();
        const { tickRepo } = this;
        channel.prefetch(1);
        const stats = { totalTicks: 0, messagesProcessed: 0 };
        channel.consume('store', async (message: ConsumeMessage | null) => {
            if (message == null) return;
            const content = JSON.parse(message.content.toString());
            const tickRows = content.ticks.map((tick: any) => {
                const { timestamp } = tick;
                return tickRepo.create({ timestamp, tickString: JSON.stringify(tick) });
            });
            await tickRepo.bulkInsert(tickRows);
            await channel.ack(message);
            stats.totalTicks += tickRows.length;
            stats.messagesProcessed += 1;
        });
        setInterval(() => {
            logJson('Ticks stored', stats);
            stats.totalTicks = 0;
            stats.messagesProcessed = 0;
        }, 10000);
        return new Promise(() => {
            logInfo('Starting tick store consumer...');
        });
    }

    formatTick(tick: any) {
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
}
