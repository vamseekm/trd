import { consumeQueue, MessageType } from '../bridge';
import { Candle } from '../types';
import { waitForever } from '../util';

export async function startCandleProcessConsumer(): Promise<void> {
    await consumeQueue(
        { name: 'candleConsumer', messageType: MessageType.candle, prefetch: 1 },
        async ({ message }) => {
            const { candles }: { candles: Candle[] } = JSON.parse(message.content.toString());
            if (!candles) return 0;
            return false;
            // await CandleRepository.upsertCandles(candles);
        },
    );
    await waitForever();
}
