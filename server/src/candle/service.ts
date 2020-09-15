import { subDays } from 'date-fns';
import pFilter from 'p-filter';
import pMap from 'p-map';

import { BrokerService } from '../broker';
import { InstrumentModel } from '../database';
import { ExchangeService } from '../exchange';
import { Log } from '../infra';
import { InstrumentService } from '../instrument';
import { CandleInterval, IBrokerCandle } from '../types';
import { IInstrument } from '../types/instrument';
import { toDayAndTime } from '../util';
import { Candle } from './model';
import { CandleRepository } from './repository';

async function candleKey({
    instrumentId,
    interval,
    date,
}: {
    instrumentId: string;
    interval: CandleInterval;
    date: Date;
}): Promise<string> {
    const { day, time } = await toDayAndTime(date);
    return `${instrumentId}-${interval}-${day}${time}`;
}

async function splitCandleKey(key: string) {
    const [exchange, tradingSymbol, period, time] = key.split('-');
    return {
        exchange,
        tradingSymbol,
        period,
        time,
    };
}

async function mapBrokerCandleToDatabaseCandle(
    instrument: IInstrument,
    interval: CandleInterval,
    candle: IBrokerCandle,
): Promise<Candle> {
    const { id } = instrument;
    return {
        k: await candleKey({ instrumentId: id, interval, date: candle.date }),
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
    instrument: IInstrument;
    interval: CandleInterval;
    from: Date;
    to: Date;
}): Promise<Candle[]> {
    const { instrumentToken } = instrument;
    const rawCandles = await BrokerService.getHistorical({ instrumentToken, interval, from, to });
    const processedCandles = await pMap(rawCandles, (candle) =>
        mapBrokerCandleToDatabaseCandle(instrument, interval, candle),
    );
    return await pFilter(processedCandles, async (candle) => {
        const { exchange } = await splitCandleKey(candle.k);
        const date = candle.t;
        return ExchangeService.isValidTick({ exchange, date });
    });
}

async function sync(): Promise<void> {
    Log.info('Syncing candles...');
    const instruments = await InstrumentService.getTrackedInstruments();
    // const instruments = await InstrumentService.getTrackedFutures('NIFTY');
    for (const instrument of instruments) {
        const { id } = instrument;
        Log.info(`Candle sync: ${id}`);
        const to = new Date();
        const from = subDays(new Date(), 7);
        const candles = await downloadCandles({ instrument: instrument, interval: CandleInterval.MIN_01, from, to });

        if (candles.length > 0) console.log(await CandleRepository.storeCandles(candles));
    }
}

export const CandleService = {
    sync,
};
