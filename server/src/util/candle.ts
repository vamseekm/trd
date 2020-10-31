import { Duration } from 'luxon';

import { ExchangeService } from '../exchange';
import { CandleConsts, CandleDuration, CandleInterval, ICandleProperties, INSTRUMENT_ID_SEPERATOR } from '../types';
import { assertNotUndefined } from './ds';
import { toDayAndTime } from './time';

function parseCandleKey(
    key: string,
): {
    key: string;
    exchange: string;
    tradingSymbol: string;
    interval: string;
    timeCode: string;
    day: string;
    time: string;
} {
    const [exchange, tradingSymbol, interval, timeCode] = key.split(INSTRUMENT_ID_SEPERATOR);
    assertNotUndefined('exchange', exchange);
    assertNotUndefined('tradingSymbol', tradingSymbol);
    assertNotUndefined('interval', interval);
    assertNotUndefined('timeCode', timeCode);
    const day = timeCode.slice(0, 4);
    const time = timeCode.slice(4);
    return { key, exchange, tradingSymbol, interval, timeCode, day, time };
}

function getCandleMetaProperties({
    instrumentId,
    interval,
    timestamp,
}: {
    instrumentId: string;
    interval: CandleInterval;
    timestamp: Date;
}): ICandleProperties {
    const separator = INSTRUMENT_ID_SEPERATOR;
    const [exchange] = instrumentId.split(separator);
    const alignedTime = getAlignedTime({ exchange, interval, timestamp });
    const { day, time } = toDayAndTime(alignedTime);
    const result = {
        key: `${instrumentId}${separator}${interval}${separator}${day}${time}`,
    };
    Object.assign(result, ExchangeService.exchangeTimeProperties({ exchange, timestamp, interval }));
    return result as any;
}

const _tzDiffInMs = Duration.fromObject({ hour: 5, minute: 30 }).as('millisecond');
function getAlignedTime({
    exchange,
    timestamp,
    interval,
    offset = 0,
}: {
    exchange: string;
    timestamp: Date;
    interval: CandleInterval | string;
    offset?: number;
}): Date {
    const exchangeConfig = ExchangeService.getExchangeTime(exchange);
    const intervalInMs = CandleDuration[interval as CandleInterval] * 1000;
    const dayIntervalInMs = CandleDuration[CandleInterval.DAY_01] * 1000;
    if (intervalInMs >= dayIntervalInMs) {
        const unixTime = timestamp.getTime();
        return new Date(unixTime - ((unixTime + _tzDiffInMs) % dayIntervalInMs));
    } else {
        const unixTime = timestamp.getTime() - exchangeConfig.dayStartOffset;
        const alignedTime =
            unixTime - (unixTime % intervalInMs) + intervalInMs * offset + exchangeConfig.dayStartOffset;
        return new Date(alignedTime);
    }
}

function getCandleMutateRecord(key: string): { key: string; score: string; value: string } {
    return { key: `${CandleConsts.QUEUE_CANDLE_DB_WRITE_KEY}`, score: `${Date.now()}`, value: key };
}

export const CandleUtil = {
    parseCandleKey,
    getCandleMetaProperties,
    getAlignedTime,
    getCandleMutateRecord,
};
