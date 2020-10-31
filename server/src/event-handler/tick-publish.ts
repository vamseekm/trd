/* eslint-disable @typescript-eslint/no-explicit-any */
import { BrokerService } from '../broker';
import { Log, Rabbit } from '../infrastructure';
import { InstrumentService } from '../instrument';
import { BridgeService } from './bridge';

export async function startTickListener(): Promise<void> {
    const instruments = await InstrumentService.findTracked();
    const tokens = instruments.map((instrument) => instrument.instrumentToken);
    const channel = await Rabbit.createChannel();
    let stats = { totalTicks: 0, totalMessages: 0, totalSize: 0 };
    await BrokerService.ticker(
        tokens,
        async (ticks: any) => {
            const payload = JSON.stringify({ ticks, received_on: new Date().getTime() });
            channel.publish(BridgeService.EXCHANGE_TICKER, BridgeService.MessageType.rawTick, Buffer.from(payload), {
                persistent: true,
            });
            if (ticks) {
                stats.totalTicks += ticks.length;
                stats.totalSize += JSON.stringify(ticks).length;
                stats.totalMessages += 1;
            }
        },
        (order_update: any) => {
            channel.publish(
                BridgeService.EXCHANGE_TICKER,
                BridgeService.MessageType.orderUpdate,
                Buffer.from(JSON.stringify({ order_update })),
                {
                    persistent: true,
                },
            );
        },
    );
    setInterval(() => {
        Log.json('Ticks published', stats);
        stats = { totalTicks: 0, totalMessages: 0, totalSize: 0 };
    }, 10000);
    return new Promise(() => {
        Log.info('Ticker started...');
    });
}
