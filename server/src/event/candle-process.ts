import { BridgeService } from '../bridge';
import { CandleRepository } from '../database';
import { IndicatorService } from '../indicator';
import { Candle } from '../types';
import { waitForever } from '../util';

export async function startCandleProcessConsumer(): Promise<void> {
    await BridgeService.consumeQueue(
        { name: 'candleConsumer', messageType: BridgeService.MessageType.candle, prefetch: 1 },
        async ({ message }) => {
            const { candles }: { candles: Candle[] } = JSON.parse(message.content.toString());
            if (!candles || candles.length === 0) return 0;
            candles.forEach((candle) => {
                candle.timestamp = new Date(candle.timestamp as any);
            });
            await CandleRepository.validate(candles);
            await IndicatorService.processCandles(candles);
            return false;
        },
    );
    await waitForever();
}
