/* eslint-disable @typescript-eslint/no-var-requires */
import { CandleCacheRepository } from '../persistance/repository/cache-candle';
import { IndicatorCacheRepository } from '../persistance/repository/cache-indicator';
import { IndicatorPipeline } from '../pipeline/indicator';
import { Candle, CandleInterval, InstrumentConsts } from '../types';
import { CandleUtil } from '../util/candle';
import { timeCodeToDate } from '../util/time';
import { AbstractIndicatorCalc } from './calcs/base';
import { flattenIndicatorDependency } from './calcs/lib';
import { EmaIndicatorCalc, SmaIndicatorCalc } from './calcs/ma';
import { MacdIndicatorCalc } from './calcs/macd';
import { VWapIndicatorCalc } from './calcs/vwap';

test('Indicator dependency flatten', async () => {
    const macd = new MacdIndicatorCalc({
        field: 'close',
        emaPeriodShort: 12,
        emaPeriodLong: 26,
        signalPeriod: 9,
        intervals: 1,
    });
    const indicators = flattenIndicatorDependency([macd, new VWapIndicatorCalc()]);
    const ids = indicators.map((indicator) => indicator.id);
    expect(ids).toMatchSnapshot();
});

function readMockCandles(): Candle[] {
    const candleData: {
        timeCode: number;
        close: number;
        open: number;
        high: number;
        low: number;
        volume: number;
        totalVolume: number;
    }[] = require('./__mocks__/candles.json');
    const exchange = 'NSE';
    const tradingSymbol = 'DUMMY';
    const instrumentId = `${exchange}${InstrumentConsts.ID_SEPERATOR}${tradingSymbol}`;
    const interval = CandleInterval.MIN_01;
    return candleData.map(
        (candle): Candle => {
            const { timeCode, close, open, high, low, volume, totalVolume } = candle;
            const key = CandleUtil.makeCandleKey({ instrumentId, interval, timeCode });
            return {
                key,
                exchange,
                instrumentId,
                timeCode,
                interval,
                close,
                timestamp: timeCodeToDate(timeCode),
                open,
                high,
                low,
                volume,
                totalVolume,
                openInterest: 0,
                totalOpenInterest: 0,
            };
        },
    );
}

async function readCandlesFromMemory() {
    const candles = readMockCandles();
    const keys = candles.map((candle) => candle.key);
    return CandleCacheRepository.getCandles(keys);
}

async function readIndicatorsFromMemory() {
    const candles = readMockCandles();
    const keys = candles.map((candle) => candle.key);
    return IndicatorCacheRepository.getIndicators(keys);
}

async function runIndicators(candles: Candle[], indicatorList: AbstractIndicatorCalc[]) {
    const keys = candles.map((candle) => candle.key);
    await IndicatorCacheRepository.remove(keys);
    await CandleCacheRepository.remove(keys);
    await CandleCacheRepository.writeCandles(candles);
    for (const candle of candles) {
        const pipelie = new IndicatorPipeline([candle], indicatorList);
        const indicators = await pipelie.execute();
        await IndicatorCacheRepository.writeIndicators(indicators);
    }
}

beforeEach(async () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    // for (const candle of readMockCandles()) {
    //     await PipelineService.processCandles([candle]);
    // }
});

test('Moving averages', async () => {
    await runIndicators(readMockCandles(), [
        new SmaIndicatorCalc({ field: 'close', intervals: 10 }),
        new EmaIndicatorCalc({ field: 'close', intervals: 10 }),
    ]);
    // console.log(await readCandlesFromMemory());
    expect(await readCandlesFromMemory()).toMatchSnapshot();
    expect(await readIndicatorsFromMemory()).toMatchSnapshot();
    expect(true).toEqual(true);
});

test('VWAP', async () => {
    await runIndicators(readMockCandles(), [new VWapIndicatorCalc()]);
    // console.log(await readCandlesFromMemory());
    expect(await readIndicatorsFromMemory()).toMatchSnapshot();
    expect(true).toEqual(true);
});
