import { CandleCacheRepository } from '../persistance';
import { IndicatorCacheRepository } from '../persistance/repository/cache-indicator';
import { Candle, Indicator, Tick } from '../types';
import { printStats } from '../util';
import { DownResolutionPipeline } from './downres';
import { IndicatorPipeline } from './indicator';
import { TickPipeline } from './tick';

const _tickMap: Record<string, Tick> = {};
let _lastChecked: Date | undefined;

function computeMissingTicks(ticks: Tick[]): Tick[] {
    if (ticks.length === 0) return [];
    if (_lastChecked != undefined && ticks[0].timestamp.getTime() - _lastChecked.getTime() < 10000) return [];
    const tickKeys = Object.keys(_tickMap);
    const missingTicks: Tick[] = [];
    for (const key of tickKeys) {
        const age = ticks[0].timestamp.getTime() - _tickMap[key].timestamp.getTime();
        if (age > 10000) {
            const renewedTick = { ..._tickMap[key], timestamp: new Date(), lastTradeTimestamp: new Date() };
            _tickMap[key] = renewedTick;
            missingTicks.push(renewedTick);
        }
    }
    _lastChecked = new Date();
    return missingTicks;
}

async function processTicks(ticks: Tick[], stdoutStats = true): Promise<Candle[]> {
    const startTime = Date.now();
    for (const tick of ticks) {
        _tickMap[tick.instrumentId] = tick;
    }
    const missingTicks: Tick[] = computeMissingTicks(ticks);
    const tickPipeline = new TickPipeline(ticks);
    const sourceCandles = await tickPipeline.execute();
    const startWriteTime = Date.now();
    await CandleCacheRepository.writeCandles(sourceCandles);
    await CandleCacheRepository.queueForDBWrites(sourceCandles);
    await processCandles(sourceCandles);
    const timeCode = sourceCandles.length > 0 ? sourceCandles[0].timeCode : 0;
    const writeTime = Date.now() - startWriteTime;
    const totalTime = Date.now() - startTime;
    const cpuTime = totalTime - writeTime;
    if (stdoutStats)
        printStats('stats', {
            ticks: ticks.length,
            mapSize: Object.keys(_tickMap).length,
            tickMiss: missingTicks.length,
            candles: sourceCandles.length,
            writeTime,
            cpuTime,
            totalTime,
            timeCode,
        });
    return sourceCandles;
}

async function processCandles(sourceCandles: Candle[]): Promise<{ candles: Candle[]; indicators: Indicator[] }> {
    const downResPipeline = new DownResolutionPipeline(sourceCandles);
    const downResCandles = await downResPipeline.execute();
    const allCandles = [...sourceCandles, ...downResCandles];
    await CandleCacheRepository.writeCandles(allCandles);
    const indicatorPipeline = new IndicatorPipeline(allCandles);
    const indicators = await indicatorPipeline.execute();
    await Promise.all([
        CandleCacheRepository.queueForDBWrites(downResCandles),
        IndicatorCacheRepository.writeIndicators(indicators),
    ]);
    return { candles: allCandles, indicators };
}

export const PipelineService = {
    processTicks,
    processCandles,
};
