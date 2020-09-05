import { subDays } from 'date-fns';
import { format } from 'date-fns-tz';
import enGB from 'date-fns/locale/en-GB';

import { BrokerService } from '../broker';
import { Log } from '../infra';
import { InstrumentService } from '../instrument';
import { InstrumentClass } from '../instrument/model';
import { CandleInterval, IBrokerCandle } from '../types';
import { Candle } from './entity';
import { CandleRepository } from './repository';

const tzOptions = { timeZone: 'Asia/Kolkata', locale: enGB };
const candleTimeFmt = 'yyMMdd/HHmm';

async function candleKey({
    instrument,
    interval,
    date,
}: {
    instrument: InstrumentClass;
    interval: CandleInterval;
    date: Date;
}): Promise<string> {
    const { globalSymbol } = instrument;
    const localDateString = format(date, candleTimeFmt, tzOptions);
    return `${globalSymbol}-${interval}-${localDateString}`;
}

async function mapBrokerCandleToDatabaseCandle(
    instrument: InstrumentClass,
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

async function downloadCandles({
    instrument,
    interval,
    from,
    to,
}: {
    instrument: InstrumentClass;
    interval: CandleInterval;
    from: Date;
    to: Date;
}): Promise<Candle[]> {
    const { instrumentToken } = instrument;
    return Promise.all(
        (await BrokerService.getHistorical({ instrumentToken, interval, from, to })).map((candle) => {
            return mapBrokerCandleToDatabaseCandle(instrument, interval, candle);
        }),
    );
}

async function storeCandles(candleList: Candle[]): Promise<void> {
    await CandleRepository.storeCandles(candleList);
}

async function sync(): Promise<void> {
    Log.info('Syncing candles...');
    const futures = await InstrumentService.getTrackedFutures('NIFTY');
    if (futures.length > 0) {
        const { globalSymbol } = futures[0];
        Log.info(globalSymbol);
        const to = new Date();
        const from = subDays(new Date(), 7);
        const candles = await downloadCandles({ instrument: futures[0], interval: CandleInterval.MIN_01, from, to });
        await storeCandles(candles);
    }
}

export const CandleService = {
    sync,
};
