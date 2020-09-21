import { plainToClass } from 'class-transformer';
import { validateOrReject } from 'class-validator';

import { consumeQueue, MessageType } from '../../bridge';
import { CandleService } from '../../candle';
import { Tick } from '../../types';
import { waitForever } from '../../util';

export async function startTickProcessConsumer(): Promise<void> {
    await consumeQueue({ name: 'tickConsumer', messageType: MessageType.tick }, async ({ message }) => {
        const { ticks }: { ticks: Tick[]; received_on: number } = JSON.parse(message.content.toString());
        if (!ticks) return 0;
        const tickTransformed = ticks.map((tick) => {
            return plainToClass(Tick, {
                ...tick,
                lastTradeTimestamp: new Date(tick.lastTradeTimestamp),
                timestamp: new Date(tick.timestamp),
            });
        });
        for (const tick of tickTransformed) {
            await validateOrReject(tick);
        }
        await CandleService.storeTickAsCandle(tickTransformed);
        return false;
    });
    await waitForever();
}
