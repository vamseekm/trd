/* eslint-disable unicorn/no-null */
import lodash from 'lodash';
import { DateTime } from 'luxon';
import plimit from 'p-limit';
import { ConsoleTransportOptions } from 'winston/lib/winston/transports';

import { EXCHANGE_TICKER, MessageType } from '../bridge';
import { consumeQueue } from '../bridge';
import { CacheService } from '../cache';
import { ExchangeService } from '../exchange';
import { Log } from '../infra';
import { PrefModel } from '../pref/model';
import { ITick } from '../types';
import { forever, propertyMapFromObjectList, toDayAndTime } from '../util';
import { Tick, TickModel } from './model';
import { TickRepository } from './repository';

async function startRawTickConsumer(): Promise<void> {
    await consumeQueue({ name: 'rawTickConsumer', messageType: MessageType.rawTick }, async ({ message, channel }) => {
        const { ticks, received_on } = JSON.parse(message.content.toString());
        if (!ticks) return;
        const processedTicks = await Promise.all(ticks.map((tick: any) => formatTick(tick)));
        const validTicks = processedTicks.filter((tick) => !!tick);
        if (validTicks.length === 0) return;
        await channel.publish(
            EXCHANGE_TICKER,
            MessageType.tick,
            Buffer.from(JSON.stringify({ ticks: validTicks, received_on })),
            {
                persistent: true,
            },
        );
        return validTicks.length;
    });
    await forever();
}

async function startTickStoreConsumer(): Promise<void> {
    await consumeQueue({ name: 'tickStoreConsumer', messageType: MessageType.tick }, async ({ message }) => {
        const { ticks, received_on }: { ticks: ITick[]; received_on: number } = JSON.parse(message.content.toString());
        if (!ticks) return 0;
        const validDate = DateTime.fromJSDate(new Date()).minus({ day: 1 }).toJSDate();
        if (received_on <= validDate.getTime()) return ticks.length;
        await storeTicks(ticks);
        return ticks.length;
    });
    return new Promise(() => {
        Log.info('Starting tick store consumer...');
    });
}

const _limit = plimit(2);
async function formatTick(tick: any): Promise<ITick | undefined> {
    return _limit(async () => {
        const {
            instrument_token,
            last_price,
            volume,
            buy_quantity,
            sell_quantity,
            timestamp,
            last_trade_time,
            oi,
            depth,
        } = tick;
        const timestampDate = new Date(timestamp);
        const instrument = await CacheService.getInstrumentByToken(instrument_token);
        if (instrument == null) throw new Error(`No instrument found with instrumentToken: ${instrument_token}`);
        const { id, exchange, tradingSymbol } = instrument;
        if (!(await ExchangeService.isValidTick({ exchange, date: timestampDate }))) return;
        const { day, time } = await toDayAndTime(timestampDate);
        return {
            instrumentId: id,
            exchange,
            tradingSymbol,
            day: Number.parseInt(day, 10),
            time: Number.parseInt(time, 10),
            lastTradedPrice: last_price,
            totalVolume: volume,
            totalBuyQuantity: buy_quantity,
            totalSellQuantity: sell_quantity,
            timestamp: timestampDate,
            lastTradeTimestamp: new Date(last_trade_time),
            openInterest: oi,
            depth,
        };
    });
}

async function storeTicks(ticks: ITick[]) {
    for (const chunk of lodash.chunk(ticks, 10)) {
        await TickModel.insertMany(chunk);
    }
}

async function startTickConsumer(): Promise<void> {
    await consumeQueue({ name: 'tickConsumer', messageType: MessageType.tick }, async ({ message, channel }) => {
        const { ticks, received_on }: { ticks: ITick[]; received_on: number } = JSON.parse(message.content.toString());
        if (!ticks) return 0;
        return false;
    });
    await forever();
}

export const TickConsumerService = {
    startRawTickConsumer,
    startTickStoreConsumer,
    startTickConsumer,
};
