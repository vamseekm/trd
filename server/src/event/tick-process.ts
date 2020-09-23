import { plainToClass } from 'class-transformer';
import { validateOrReject } from 'class-validator';

import { consumeQueue, EXCHANGE_TICKER, MessageType } from '../bridge';
import { CandleService } from '../candle';
import { Tick } from '../types';
import { waitForever } from '../util';

export async function startTickProcessConsumer(): Promise<void> {
    await consumeQueue({ name: 'tickConsumer', messageType: MessageType.tick }, async ({ message, channel }) => {
        const { ticks }: { ticks: Tick[]; received_on: number } = JSON.parse(message.content.toString());
        if (!ticks) return 0;
        const tickTransformed = ticks.map((tick) => {
            return plainToClass(Tick, {
                ...tick,
                lastTradeTimestamp: new Date(tick.lastTradeTimestamp),
                timestamp: new Date(tick.timestamp),
                openInterest: tick.openInterest || 0,
                totalSellQuantity: tick.totalSellQuantity || 0,
                totalBuyQuantity: tick.totalBuyQuantity || 0,
                totalVolume: tick.totalVolume || 0,
            });
        });
        for (const tick of tickTransformed) {
            await validateOrReject(tick);
        }
        const candles = await CandleService.bulkConvertTicksToCandles(tickTransformed);
        await channel.publish(EXCHANGE_TICKER, MessageType.candle, Buffer.from(JSON.stringify({ candles })), {
            persistent: true,
        });
        return candles.length;
    });
    await waitForever();
}
