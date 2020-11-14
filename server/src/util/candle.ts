import { Duration } from 'luxon';

import { ExchangeService } from '../exchange';
import { CandleDuration, CandleInterval, ICandleProperties, InstrumentConsts } from '../types';
import { assertNotUndefined } from './lib/algo-ds';
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
    const [exchange, tradingSymbol, interval, timeCode] = key.split(InstrumentConsts.ID_SEPERATOR);
    assertNotUndefined('exchange', exchange);
    assertNotUndefined('tradingSymbol', tradingSymbol);
    assertNotUndefined('interval', interval);
    assertNotUndefined('timeCode', timeCode);
    const day = timeCode.slice(0, 4);
    const time = timeCode.slice(4);
    return { key, exchange, tradingSymbol, interval, timeCode, day, time };
}
function makeCandleKey({
    instrumentId,
    exchange,
    tradingSymbol,
    interval,
    day,
    time,
    timeCode,
}: {
    instrumentId?: string;
    exchange?: string;
    tradingSymbol?: string;
    interval: string;
    day?: string;
    time?: string;
    timeCode?: string;
}): string {
    const separator = InstrumentConsts.ID_SEPERATOR;
    if (instrumentId == undefined) {
        assertNotUndefined('exchange', exchange);
        assertNotUndefined('tradingSymbol', tradingSymbol);
        instrumentId = `${exchange}${separator}${tradingSymbol}`;
    }
    if (timeCode == undefined) {
        assertNotUndefined('day', day);
        assertNotUndefined('time', time);
        timeCode = `${day}${time}`;
    }
    return `${instrumentId}${separator}${interval}${separator}${timeCode}`;
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
    const separator = InstrumentConsts.ID_SEPERATOR;
    const [exchange] = instrumentId.split(separator);
    const alignedTime = getAlignedTime({ exchange, interval, timestamp });
    const { day, time } = toDayAndTime(alignedTime);
    const result = {
        key: makeCandleKey({ instrumentId, interval, day, time }),
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

export const CandleUtil = {
    parseCandleKey,
    getCandleMetaProperties,
    getAlignedTime,
    makeCandleKey,
};
