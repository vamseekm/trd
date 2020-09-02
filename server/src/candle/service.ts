import { subDays } from 'date-fns';
import { format } from 'date-fns-tz';
import enGB from 'date-fns/locale/en-GB';

import { BrokerService } from '../broker';
import { Log } from '../infra';
import { Instrument, InstrumentService } from '../instrument';
import { CandleInterval, IBrokerCandle } from '../types';
import { Candle } from './entity';

const tzOptions = { timeZone: 'Asia/Kolkata', locale: enGB };
const candleTimeFmt = 'ddMMyy/HHmm';

async function candleKey({
    instrument,
    interval,
    date,
}: {
    instrument: Instrument;
    interval: CandleInterval;
    date: Date;
}): Promise<string> {
    const { globalSymbol } = instrument;
    const localDateString = format(date, candleTimeFmt, tzOptions);
    return `${globalSymbol}-${interval}-${localDateString}`;
}

async function mapBrokerCandleToDatabaseCandle(
    instrument: Instrument,
    interval: CandleInterval,
    candle: IBrokerCandle,
): Promise<Candle> {
    return {
        k: await candleKey({ instrument, interval, date: candle.date }),
        t: candle.date,
        o: candle.open,
        h: candle.high,
        l: candle.low,
        c: candle.close,
        v: candle.volume,
        tv: 0,
        oi: 0,
        toi: 0,
    };
}

async function syncCandles({
    instrument,
    interval,
    full = false,
}: {
    instrument: Instrument;
    interval: CandleInterval;
    full?: boolean;
}): Promise<void> {
    console.log(instrument);
    const { instrumentToken } = instrument;
    const to = new Date();
    const from = subDays(to, 7);
    // const candles = await BrokerService.getHistorical({ instrumentToken, interval, from, to });
    // console.log(candles);
    const candles = await Promise.all(
        (await BrokerService.getHistorical({ instrumentToken, interval, from, to })).map((candle) => {
            return mapBrokerCandleToDatabaseCandle(instrument, interval, candle);
        }),
    );
}

async function sync(): Promise<void> {
    Log.info('Syncing candles...');
    const futures = await InstrumentService.getTrackedFutures('NIFTY');
    if (futures.length > 0) {
        const { globalSymbol } = futures[0];
        Log.info(globalSymbol);
        await syncCandles({ instrument: futures[0], interval: CandleInterval.MIN_01 });
        console.log(futures[0]);
    }
}

export const CandleService = {
    sync,
};
