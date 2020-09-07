import { subDays } from 'date-fns';
import { format } from 'date-fns-tz';

import { BrokerService } from '../broker';
import { Log } from '../infra';
import { InstrumentService } from '../instrument';
import { Instrument } from '../instrument/model';
import { CandleInterval, IBrokerCandle } from '../types';
import { defaultTimeZone } from '../util';
import { Candle } from './model';
import { CandleRepository } from './repository';

const _candleTimeFmt = 'yyMMdd/HHmm';

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
    const localDateString = format(date, _candleTimeFmt, await defaultTimeZone());
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

async function downloadCandles({
    instrument,
    interval,
    from,
    to,
}: {
    instrument: Instrument;
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

async function sync(): Promise<void> {
    Log.info('Syncing candles...');
    const instruments = await InstrumentService.getTrackedInstruments();
    // const instruments = await InstrumentService.getTrackedFutures('NIFTY');
    for (const instrument of instruments) {
        const { globalSymbol } = instrument;
        Log.info(`Candle sync: ${globalSymbol}`);
        const to = new Date();
        const from = subDays(new Date(), 7);
        const candles = await downloadCandles({ instrument: instrument, interval: CandleInterval.MIN_01, from, to });
        if (candles.length > 0) console.log(await CandleRepository.storeCandles(candles));
    }
}

export const CandleService = {
    sync,
};
