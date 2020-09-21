import { DateTime } from 'luxon';
import pFilter from 'p-filter';
import pMap from 'p-map';

import { BrokerService } from '../broker';
import { CandleRepository } from '../database';
import { ExchangeService } from '../exchange';
import { Log } from '../infra';
import { InstrumentService } from '../instrument';
import { Candle, CandleDuration, CandleInterval, IBrokerCandle, IInstrument, Tick } from '../types';
import { toDayAndTime } from '../util';

async function candleKey({
    instrumentId,
    interval,
    timestamp,
}: {
    instrumentId: string;
    interval: CandleInterval;
    timestamp: Date;
}): Promise<string> {
    const { day, time } = await toDayAndTime(timestamp);
    return `${instrumentId}-${interval}-${day}${time}`;
}

async function getAlignedTime({
    exchange,
    timestamp,
    interval,
    offset = 0,
}: {
    exchange: string;
    timestamp: Date;
    interval: CandleInterval;
    offset?: number;
}): Promise<Date> {
    const exchangeConfig = await ExchangeService.getExchangeTime(exchange);
    const unixTime = timestamp.getTime() - exchangeConfig.dayStartOffset;
    const intervalInMs = CandleDuration[interval] * 1000;
    const alignedTime = unixTime - (unixTime % intervalInMs) + intervalInMs * offset + exchangeConfig.dayStartOffset;
    return new Date(alignedTime);
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
        key: await candleKey({ instrumentId: id, interval, timestamp: candle.date }),
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
        return ExchangeService.isValidTime({ exchange, date });
    });
}

async function downloadHistorical(): Promise<void> {
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
    // Log.pretty(tick);
    const key = await candleKey({ ...tick, interval: CandleInterval.MIN_05 });
    const candleConfig = { ...tick, interval: CandleInterval.MIN_30 };
    console.log('CCurrent:', tick.timestamp.toLocaleString());
    console.log('TCurrent:', (await getAlignedTime({ ...candleConfig, offset: 0 })).toLocaleString());
    console.log('PCurrent:', (await getAlignedTime({ ...candleConfig, offset: -1 })).toLocaleString());
    console.log('NCurrent:', (await getAlignedTime({ ...candleConfig, offset: 1 })).toLocaleString());
}

async function storeTickAsCandle(ticks: Tick[]): Promise<void> {
    for (const tick of ticks) {
        await mapTickToCandle(tick);
        break;
    }
}

export const CandleService = {
    downloadHistorical,
    storeTickAsCandle,
};
