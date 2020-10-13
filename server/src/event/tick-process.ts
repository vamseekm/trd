import { BridgeService } from '../bridge';
import { CandleService } from '../candle';
import { Tick, validateTick } from '../types';
import { waitForever } from '../util';
import { CacheRepository } from '../database/repository/cache';

export async function startTickProcessConsumer(): Promise<void> {
    await BridgeService.consumeQueue(
        { name: 'tickConsumer', messageType: BridgeService.MessageType.tick },
        async ({ message, channel }) => {
            const { ticks: rawTicks }: { ticks: Tick[]; received_on: number } = JSON.parse(message.content.toString());
            if (!rawTicks) return 0;
            const validatedTicks: Tick[] = [];
            for (const tick of rawTicks) {
                const newTick: Tick = {
                    ...tick,
                    lastTradeTimestamp: new Date(tick.lastTradeTimestamp),
                    timestamp: new Date(tick.timestamp),
                    openInterest: tick.openInterest || 0,
                    totalSellQuantity: tick.totalSellQuantity || 0,
                    totalBuyQuantity: tick.totalBuyQuantity || 0,
                    totalVolume: tick.totalVolume || 0,
                };
                if (validateTick(newTick) === false) throw new Error(JSON.stringify(validateTick.errors, null, 2));
                validatedTicks.push(newTick);
            }
            if (validatedTicks.length === 0) return 0;
            const candles = await CandleService.bulkConvertTicksToCandles(validatedTicks);
            channel.publish(
                BridgeService.EXCHANGE_TICKER,
                BridgeService.MessageType.candle,
                Buffer.from(JSON.stringify({ candles })),
                {
                    persistent: true,
                },
            );
            return candles.length;
        },
    );
    await waitForever();
}
