import { subDays } from 'date-fns';
import pFilter from 'p-filter';
import pMap from 'p-map';

import { BrokerService } from '../broker';
import { ExchangeService } from '../exchange';
import { Log } from '../infra';
import { InstrumentService } from '../instrument';
import { Instrument } from '../instrument/model';
import { CandleInterval, IBrokerCandle } from '../types';
import { toDayAndTime } from '../util';
import { Candle } from './model';
import { CandleRepository } from './repository';

async function candleKey({
    globalSymbol,
    interval,
    date,
}: {
    globalSymbol: string;
    interval: CandleInterval;
    date: Date;
}): Promise<string> {
    const { day, time } = await toDayAndTime(date);
    return `${globalSymbol}-${interval}-${day}-${time}`;
}

async function mapBrokerCandleToDatabaseCandle(
    instrument: Instrument,
    interval: CandleInterval,
    candle: IBrokerCandle,
): Promise<Candle> {
    const { globalSymbol } = instrument;
    return {
        k: await candleKey({ globalSymbol, interval, date: candle.date }),
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
    const rawCandles = await BrokerService.getHistorical({ instrumentToken, interval, from, to });
    const processedCandles = await pMap(rawCandles, (candle) =>
        mapBrokerCandleToDatabaseCandle(instrument, interval, candle),
    );
    return await pFilter(processedCandles, (candle) => {
        const exchange = candle.k.split('-')[0];
        const date = candle.t;
        return ExchangeService.isValidTick({ exchange, date });
    });
    // const candles = await Promise.all(
    //     (await BrokerService.getHistorical({ instrumentToken, interval, from, to })).map((candle) => {
    //         return mapBrokerCandleToDatabaseCandle(instrument, interval, candle);
    //     }),
    // );
    // return candles.filter(async (candle) => {
    //     const exchange = candle.k.split('-')[0];
    //     const date = candle.t;
    //     console.log(exchange, date, ExchangeService.isValidTick({ exchange, date }));
    //     return await ExchangeService.isValidTick({ exchange, date });
    // });
}

async function sync(): Promise<void> {
    Log.info('Syncing candles...');
    // const instruments = await InstrumentService.getTrackedInstruments();
    const instruments = await InstrumentService.getTrackedFutures('NIFTY');
    for (const instrument of instruments) {
        const { globalSymbol } = instrument;
        Log.info(`Candle sync: ${globalSymbol}`);
        const to = new Date();
        const from = subDays(new Date(), 1);
        const candles = await downloadCandles({ instrument: instrument, interval: CandleInterval.MIN_01, from, to });

        console.log(candles.map((c) => c.k).join('\n'));
        if (candles.length > 0) console.log(await CandleRepository.storeCandles(candles));
        break;
    }
}

export const CandleService = {
    sync,
};
