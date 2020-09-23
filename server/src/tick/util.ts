import plimit from 'p-limit';

import { CacheRepository } from '../database';
import { ExchangeService } from '../exchange';
import { Tick } from '../types';
import { toDayAndTime } from '../util';
const _limit = plimit(2);
export async function formatTick(tick: any): Promise<Tick | undefined> {
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
        const instrument = await CacheRepository.getInstrumentByToken(instrument_token);
        if (instrument == undefined) throw new Error(`No instrument found with instrumentToken: ${instrument_token}`);
        const { id, exchange, tradingSymbol } = instrument;
        if (!(await ExchangeService.isValidTime({ exchange, date: timestampDate }))) return;
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
