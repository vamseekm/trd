import lodash from 'lodash';
import { DateTime } from 'luxon';
import pLimit from 'p-limit';

import { BrokerService } from '../../broker';
import { InstrumentRepository } from '../../database';
import { Log } from '../../infra';
import { BrokerQuoteLtp, Instrument, INSTRUMENT_ID_SEPERATOR } from '../../types';
import { sleep } from '../../util';
import { InstrumentMetaService } from './instrument-meta';

async function download(): Promise<void> {
    const exchanges = (await BrokerService.getExchanges()).filter(
        (exchange) => exchange === 'NSE' || exchange === 'NFO',
    );
    Log.json('Exchange list:', { exchanges });
    for (const exchange of exchanges) {
        try {
            Log.info(`Syncing exchange: ${exchange}`);
            const instruments = await BrokerService.getInstrumentsByExchange(exchange);
            Log.info(`\tFetched ${instruments.length} instruments...`);
            Log.json('\tSync result', await InstrumentRepository.upsertInstruments(exchange, instruments));
        } catch (error) {
            Log.error(error);
        }
    }
    Log.info('\tDone syncing instruments.');
}

async function getOptionExpiryListToTrack(name: string): Promise<Date[]> {
    const futureInstruments = await InstrumentRepository.fetchFnoInstruments({ name, segment: 'NFO-FUT', take: 2 });
    const instruments = await InstrumentRepository.fetchFnoInstruments({ name, segment: 'NFO-OPT' });
    const optionExpirySet = new Set<string>(instruments.map((instrument) => instrument.expiry.toISOString()));
    const expiryList = [...optionExpirySet]
        .sort()
        .slice(0, 2)
        .concat(futureInstruments.map((instrument) => instrument.expiry.toISOString()))
        .sort();
    return [...new Set(expiryList)].map((expiry) => new Date(expiry));
}

async function getFnoInstrumentsToTrack(name: string): Promise<Instrument[]> {
    let futures = await InstrumentRepository.fetchFnoInstruments({ name, segment: 'NFO-FUT', take: 2 });
    await updateLTP(futures);
    futures = await InstrumentRepository.fetchFnoInstruments({ name, segment: 'NFO-FUT', take: 2 });
    const expiryList = await getOptionExpiryListToTrack(name);
    //TODO: Config
    const stirkeIntervalMap: Record<string, number> = {
        NIFTY: 100,
        BANKNIFTY: 100,
    };
    const instruments: Instrument[] = [...futures];
    const strikeInterval = stirkeIntervalMap[name] || 1;
    const strikeLimitPercent = 0.1;
    if (futures.length > 0) {
        const { lastPrice } = futures[0];
        const strikeLimitHigh = lastPrice * (1 + strikeLimitPercent);
        const strikeLimitLow = lastPrice * (1 - strikeLimitPercent);
        for (const expiry of expiryList) {
            const allOptionList = await InstrumentRepository.findOptions({
                expiry,
                name,
                segment: 'NFO-OPT',
                strikeLimitLow,
                strikeLimitHigh,
                strikeInterval,
            });
            for (const option of allOptionList) {
                instruments.push(option);
            }
        }
    }
    return instruments;
}

async function getTrackableFnoInstruments(): Promise<string[]> {
    return (await getFnoInstrumentsToTrack('NIFTY'))
        .concat(await getFnoInstrumentsToTrack('BANKNIFTY'))
        .map((instrument) => instrument.id);
}

async function track(): Promise<void> {
    Log.info('Tracking instruments...');
    const indices: string[] = [
        'NSE:INDIA VIX',
        'NSE:NIFTY 50',
        'NSE:NIFTY 500',
        'NSE:NIFTY BANK',
        'NSE:NIFTY AUTO',
        'NSE:NIFTY COMMODITIES',
        'NSE:NIFTY CONSUMPTION',
        'NSE:NIFTY ENERGY',
        'NSE:NIFTY FMCG',
        'NSE:NIFTY INFRA',
        'NSE:NIFTY IT',
        'NSE:NIFTY MEDIA',
        'NSE:NIFTY METAL',
        'NSE:NIFTY MNC',
        'NSE:NIFTY PHARMA',
        'NSE:NIFTY PSE',
        'NSE:NIFTY REALTY',
        'NSE:NIFTYBEES',
        'NSE:BANKBEES',
        'NSE:GOLDBEES',
    ];

    const topInstruments = (await InstrumentRepository.findTopInstruments({ exchange: 'NSE', take: 50 })).map(
        (instrument) => instrument.id,
    );
    const fnoInstruments = await getTrackableFnoInstruments();
    const allInstruments = [...indices, ...topInstruments, ...fnoInstruments];
    Log.json('Tracking:', {
        indices: indices.length,
        topInstruments: topInstruments.length,
        fnoInstruments: fnoInstruments.length,
    });

    const alreadyTrackedIds = await (await InstrumentRepository.findAutoTrackedInstruments()).map(
        (instrument) => instrument.id,
    );
    Log.info(`\tUntracking previously tracked ${alreadyTrackedIds.length} instruments.`);
    await InstrumentRepository.trackInstruments(alreadyTrackedIds, false);
    await InstrumentRepository.trackInstruments(allInstruments, true);
    Log.info(`\tTracking ${allInstruments.length} instruments.`);
}

async function updateLTP(insrumentList: Instrument[]): Promise<void> {
    const chunks = lodash.chunk(
        insrumentList.map((instrument) => `${instrument.exchange}:${instrument.tradingSymbol}`),
        100,
    );
    for (const [i, chunk] of chunks.entries()) {
        Log.info(`Fetching LTP of chunk: ${i + 1}/${chunks.length}`);
        const ltpList: BrokerQuoteLtp[] = (await BrokerService.getLTP(chunk)).map((item) => {
            return { ...item, id: item.id.replace(':', INSTRUMENT_ID_SEPERATOR) };
        });
        await InstrumentRepository.updateInstruments(
            ltpList.map((ltp: Partial<Instrument>) => {
                return { ...ltp, lastPriceUpdatedOn: new Date() };
            }),
        );
        await sleep(300);
    }
}

async function updateLTPAll(): Promise<void> {
    const maxExpiry = DateTime.local().plus({ month: 3 }).toJSDate();
    const lastUpdatedBefore = DateTime.local().minus({ day: 1 }).toJSDate();
    const instruments = await InstrumentRepository.findInstrumentsWithPendingLTPUpdates({
        maxExpiry,
        lastUpdatedBefore,
    });
    console.log('Updating ltp of :', instruments.length);
    await updateLTP(instruments);
}

async function updateLTPInitial(): Promise<void> {
    Log.info('Updating LTP of initial instruments...');
    const maxExpiry = DateTime.local().plus({ month: 2 }).toJSDate();
    const instruments = await InstrumentRepository.findAllInstruments(maxExpiry);
    await updateLTP(instruments);
    Log.info('\tDone.');
}

async function updateLTPTracked(): Promise<void> {
    const trackedInstruments = await InstrumentRepository.findTrackedInstruments();
    Log.info(`Updating LTP of ${trackedInstruments.length} tracked instruments...`);
    await updateLTP(trackedInstruments);
    Log.info('\tDone.');
}

async function updateMeta(): Promise<void> {
    const instruments = await InstrumentRepository.findByOutdatedMeta();
    const limiter = pLimit(4);
    const total = instruments.length;
    Log.info(`Found ${total} outdated meta instruments.`);
    let count = 0;
    const list = instruments.map((instrument) => {
        return limiter(async () => {
            const metaInfo = await InstrumentMetaService.downloadSymbolMeta(instrument);
            if (metaInfo != undefined) await InstrumentRepository.updateInstrument(metaInfo);
            count += 1;
            Log.json(`Updating meta: ${count}/${total}`, metaInfo?.freeFloatMarketCap);
        });
    });
    await Promise.all(list);
    const instrumentsWithMeta = lodash.sortBy(
        await InstrumentRepository.findWithMetaLastUpdated(),
        ({ freeFloatMarketCap }) => (freeFloatMarketCap || 0) * -1,
    );
    Log.info(`\tUpdating rank...`);
    for (const [i, instrument] of instrumentsWithMeta.entries()) {
        await InstrumentRepository.updateInstrument({ id: instrument.id, rank: i + 1 });
    }
}

async function debug(): Promise<void> {
    await getTrackableFnoInstruments();
}

export const InstrumentService = {
    download,
    updateLTPAll,
    track,
    updateLTPInitial,
    updateLTPTracked,
    updateMeta,
    findTracked: InstrumentRepository.findTrackedInstruments,
    debug,
};
