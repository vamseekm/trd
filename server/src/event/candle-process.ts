import { consumeQueue, MessageType } from '../bridge';
import { CandleRepository } from '../database';
import { CacheRepository } from '../database/repository/cache';
import { Candle } from '../types';
import { waitForever } from '../util';

export async function startCandleProcessConsumer(): Promise<void> {
    await consumeQueue(
        { name: 'candleConsumer', messageType: MessageType.candle, prefetch: 1 },
        async ({ message }) => {
            const { candles }: { candles: Candle[] } = JSON.parse(message.content.toString());
            if (!candles || candles.length === 0) return 0;
            await CacheRepository.writeCandles(candles);
            return candles.length;
        },
    );
    await waitForever();
}
