import fs from 'fs';
import { DateTime } from 'luxon';
import mkdirp from 'mkdirp';
import os from 'os';
import path from 'path';
import zlib from 'zlib';

import { Log } from '../infrastructure';
import { Config } from '../infrastructure/config';
import { TickRepository } from '../persistance';
import { PersistentTick, Tick } from '../types/tick';
import { toDayAndTime } from '../util/time';

async function clean(): Promise<void> {
    Log.info('Removing old ticks ...');
    const removeDataOlderThan = DateTime.local().minus({ day: 1 }).toJSDate();
    const count = await TickRepository.removeDataOlderThan(removeDataOlderThan);
    Log.info(`\tRemoved ${count} ticks.`);
    // Log.info(`\tVaccuming...`);
    // await DatabaseService.vaccume('public.tick');
}

async function backup(): Promise<void> {
    Log.info('Backing up ticks ...');
    // const days = await TickRepository.getTradingDays();
    const instrumentIdList = await TickRepository.getUniqueInstruments();
    const tickDataPath = Config.get('TICK_DATA_PATH').replace('~', os.homedir);
    for (const [index, instrumentId] of instrumentIdList.entries()) {
        const [exchange, tradingSymbol] = instrumentId.split(':');
        const instrumentTickPath = path.join(tickDataPath, exchange, tradingSymbol);
        await mkdirp(instrumentTickPath);
        const instrumentTicks = (await TickRepository.getTicksByInstrumentId(instrumentId)).map(toPersistentTick);
        const ticksMap: Record<string, PersistentTick[]> = {};
        for (const tick of instrumentTicks) {
            const { day } = toDayAndTime(tick.timestamp);
            if (ticksMap[day] == undefined) ticksMap[day] = [];
            ticksMap[day].push(tick);
        }
        for (const [day, dayTicks] of Object.entries(ticksMap)) {
            const instrumentDayTicksPath = path.join(instrumentTickPath, `${day}.json`);
            Log.info(`\t${index + 1}/${instrumentIdList.length} Writing ${instrumentDayTicksPath} ...`);
            fs.writeFileSync(`${instrumentDayTicksPath}.gz`, zlib.gzipSync(JSON.stringify(dayTicks)));
        }
    }
}

function toPersistentTick(tick: Tick): PersistentTick {
    const {
        instrumentId,
        lastTradedPrice,
        totalVolume,
        totalBuyQuantity,
        totalSellQuantity,
        timestamp,
        lastTradeTimestamp,
        openInterest,
        depth,
    } = tick;

    return {
        instrumentId,
        lastTradedPrice,
        totalVolume,
        totalBuyQuantity,
        totalSellQuantity,
        timestamp,
        lastTradeTimestamp,
        openInterest,
        depth,
    };
}

export const TickService = {
    clean,
    backup,
};
