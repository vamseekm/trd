import { Log } from '../infra';

async function sync(): Promise<void> {
    Log.info('Syncing candles...');
}

export const CandleService = {
    sync,
};
