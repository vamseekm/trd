import { transformAndValidate } from 'class-transformer-validator';

import { consumeQueue, EXCHANGE_TICKER, MessageType } from '../bridge';
import { CandleService } from '../candle';
import { Tick } from '../types';
import { waitForever } from '../util';

export async function startTickProcessConsumer(): Promise<void> {
    await consumeQueue({ name: 'tickConsumer', messageType: MessageType.tick }, async ({ message, channel }) => {
        const { ticks: rawTicks }: { ticks: Tick[]; received_on: number } = JSON.parse(message.content.toString());
        if (!rawTicks) return 0;
        const validatedTicks: Tick[] = [];
        for (const tick of rawTicks) {
            validatedTicks.push(
                await transformAndValidate(Tick, {
                    ...tick,
                    lastTradeTimestamp: new Date(tick.lastTradeTimestamp),
                    timestamp: new Date(tick.timestamp),
                    openInterest: tick.openInterest || 0,
                    totalSellQuantity: tick.totalSellQuantity || 0,
                    totalBuyQuantity: tick.totalBuyQuantity || 0,
                    totalVolume: tick.totalVolume || 0,
                }),
            );
        }
        const candles = await CandleService.bulkConvertTicksToCandles(validatedTicks);
        channel.publish(EXCHANGE_TICKER, MessageType.candle, Buffer.from(JSON.stringify({ candles })), {
            persistent: true,
        });
        return candles.length;
    });
    await waitForever();
}
