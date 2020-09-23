import { startCandleProcessConsumer } from './candle-process';
import { startTickProcessConsumer } from './tick-process';
import { startTickListener } from './tick-publish';
import { startTickRawConsumer } from './tick-raw';
import { startTickStoreConsumer } from './tick-store';

export const EventService = {
    startTickProcessConsumer,
    startTickRawConsumer,
    startTickStoreConsumer,
    startTickListener,
    startCandleProcessConsumer,
};
