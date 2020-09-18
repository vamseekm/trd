import { DateTime } from 'luxon';
import pFilter from 'p-filter';
import pMap from 'p-map';

import { BrokerService } from '../broker';
import { InstrumentModel } from '../database';
import { CandleModel } from '../database';
import { ExchangeService } from '../exchange';
import { Log } from '../infra';
import { InstrumentService } from '../instrument';
import { Candle, CandleInterval, IBrokerCandle, Tick } from '../types';
import { IInstrument } from '../types/instrument';
import { toDayAndTime } from '../util';
import { CandleRepository } from './repository';

async function mapCandleKey({
    instrumentId,
    interval,
    timestamp,
}: {
    instrumentId: string;
    interval: CandleInterval;
    timestamp: Date;
}): Promise<string> {
    console.log(timestamp);
    const { day, time } = await toDayAndTime(timestamp);
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
        key: await mapCandleKey({ instrumentId: id, interval, timestamp: candle.date }),
        timestamp: candle.date,
        open: candle.open,
        high: candle.high,
        low: candle.low,
        close: candle.close,
        volume: candle.volume,
        totalVolume: 0,
        openInterest: 0,
        totalOpenInterest: 0,
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
        const { exchange } = await splitCandleKey(candle.key);
        const date = candle.timestamp;
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
        const from = DateTime.local().minus({ day: 7 }).toJSDate();
        const candles = await downloadCandles({ instrument: instrument, interval: CandleInterval.MIN_01, from, to });

        if (candles.length > 0) console.log(await CandleRepository.storeCandles(candles));
    }
}

async function mapTickToCandle(tick: Tick) {
    console.log(tick);
    const candleKey = await mapCandleKey({ ...tick, interval: CandleInterval.MIN_01 });
    console.log(candleKey);
}

async function storeTickAsCandle(ticks: Tick[]): Promise<void> {
    for (const tick of ticks) {
        mapTickToCandle(tick);
        break;
    }
}

export const CandleService = {
    sync,
    storeTickAsCandle,
};
