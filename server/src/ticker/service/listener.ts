import { BrokerService } from '../../broker';
import { Log, Rabbit } from '../../infra';
import { InstrumentService } from '../../instrument';

async function start(): Promise<any> {
    const instruments = await InstrumentService.getTrackedInstruments();
    const tokens = instruments.map((instrument) => instrument.instrumentToken);
    const channel = await Rabbit.channel();
    let stats = { totalTicks: 0, totalMessages: 0, totalSize: 0 };
    await BrokerService.ticker(
        tokens,
        async (ticks: any) => {
            const payload = JSON.stringify({ ticks, received_on: new Date().getTime() });
            channel.publish('ticker_ex', 'tick_raw', Buffer.from(payload), { persistent: true });
            if (ticks) {
                stats.totalTicks += ticks.length;
                stats.totalSize += JSON.stringify(ticks).length;
                stats.totalMessages += 1;
            }
        },
        (order_update: any) => {
            channel.publish('ticker_ex', 'order_update', Buffer.from(JSON.stringify({ order_update })));
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

export const TickListenerService = {
    start,
};
