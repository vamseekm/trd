import { BrokerService } from '../../broker';
import { Log, Rabbit } from '../../infra';
import { InstrumentService } from '../../instrument';

async function start(): Promise<any> {
    const instruments = await InstrumentService.getTrackedInstruments();
    const tokens = instruments.map((instrument) => instrument.instrumentToken);
    const channel = await Rabbit.channel();
    let stats = { totalCount: 0, totalSize: 0 };
    await BrokerService.ticker(
        tokens,
        async (ticks: any) => {
            const payload = JSON.stringify({ ticks, received_on: new Date().getTime() });
            channel.publish('ticker_ex', 'tick_raw', Buffer.from(payload), { persistent: true });
            if (ticks) {
                stats.totalCount += ticks.length;
                stats.totalSize += JSON.stringify(ticks).length;
            }
        },
        (order_update: any) => {
            channel.publish('ticker_ex', 'order_update', Buffer.from(JSON.stringify({ order_update })));
        },
    );
    setInterval(() => {
        Log.json('Raw ticks published', stats);
        stats = { totalCount: 0, totalSize: 0 };
    }, 10000);
    return new Promise(() => {
        Log.info('Ticker started...');
    });
}

export const TickListenerService = {
    start,
};
