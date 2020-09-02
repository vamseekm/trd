import CliProgress from 'cli-progress';
import { subDays } from 'date-fns';
import { diff as diffObject } from 'deep-diff';
import lodash from 'lodash';

import { BrokerService } from '../../broker';
import { Log } from '../../infra';
import { BrokerQuoteLtp, IInstrument } from '../../types';
import { diffListOfObjects, mapFromObjectList } from '../../util';
import { Instrument, InstrumentMeta } from '../entity';
import { InstrumentRepository } from '../repository/instrument';
import { InstrumentMetaRepository } from '../repository/instrument-meta';
import { InstrumentMetaService } from './instrument-meta';

async function storeInstruments(exchange: string, inputInstruments: IInstrument[]): Promise<void> {
    const databaseInstruments: IInstrument[] = (
        await InstrumentRepository.findInstrumentsBy({ search: { exchange } })
    ).map((item) => {
        // exclude props that shouldn't be considered for comparison.
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { lastPrice, lastPriceUpdatedOn, live, track, rank, updatedAt, createdAt, ...rest } = item;
        return { ...rest, lastPrice: 0 };
    });
    const diff = diffListOfObjects(databaseInstruments, inputInstruments, 'globalSymbol');
    Log.json(`Instrument stats for exchange: ${exchange}`, diff.stats);
    const removedSymbols = diff.removed.map((item) => item.globalSymbol);
    Log.info(`Disabling ... ${removedSymbols.length}`);
    if (removedSymbols.length > 0) {
        await InstrumentRepository.markInstrumentsRemoved(removedSymbols);
    }
    const inputInstrumentMap = await mapFromObjectList(inputInstruments, 'globalSymbol');
    Log.info(`Updating ... ${diff.updated.length}`);
    if (diff.updated.length > 0) {
        //show first diff to understand which things have changed.
        const databaseInstrumentsMap = await mapFromObjectList(databaseInstruments, 'globalSymbol');
        // console.log(diff.updated[0]);
        // console.log(databaseInstrumentsMap[diff.updated[0].globalSymbol]);
        console.log(diffObject(diff.updated[0], databaseInstrumentsMap[diff.updated[0].globalSymbol]));
        const updateList: Partial<Instrument>[] = [];
        for (const instrument of diff.updated) {
            updateList.push({ ...inputInstrumentMap[instrument.globalSymbol], live: true });
        }
        await InstrumentRepository.updateInstruments(updateList);
    }
    Log.info(`Inserting ... ${diff.added.length}`);
    if (diff.added.length > 0) {
        const insertList: Partial<Instrument>[] = [];
        for (const instrument of diff.added) {
            insertList.push({ ...instrument, live: true, lastPriceUpdatedOn: new Date(0) });
        }
        await InstrumentRepository.insertInstruments(insertList);
    }
    Log.info(`Done processing instruments.`);
}

async function syncInstruments(): Promise<void> {
    const exchanges = (await BrokerService.getExchanges()).filter((ex) => ex !== 'MF');
    Log.json('Exchange list:', { exchanges });
    for (const exchange of exchanges) {
        try {
            Log.info(`Syncing exchange: ${exchange}`);
            const instruments = await BrokerService.getInstrumentsByExchange(exchange);
            await storeInstruments(exchange, instruments);
        } catch (error) {
            Log.error(error);
        }
    }
}

async function updateRanks(): Promise<void> {
    Log.info('Updating ranks...');
    const metaInstruments = (await InstrumentMetaRepository.findMetaInstrumentsBy({ exchange: 'NSE' }))
        .filter((instrument) => instrument.freeFloatMarketCap)
        .sort((a, b) => b.freeFloatMarketCap - a.freeFloatMarketCap);
    const updateList = metaInstruments.map((instrumentMeta: InstrumentMeta, index: number) => {
        const { globalSymbol } = instrumentMeta;
        return { globalSymbol, rank: index + 1 };
    });
    await InstrumentRepository.updateInstruments(updateList);
    Log.info('Done updating ranks.');
}

async function getOptionExpiryListToTrack(name: string): Promise<Date[]> {
    const futureInstruments = await InstrumentRepository.fetchFnoInstruments({ name, segment: 'NFO-FUT', limit: 2 });
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
    const futures = await InstrumentRepository.fetchFnoInstruments({ name, segment: 'NFO-FUT', limit: 2 });
    const expiryList = await getOptionExpiryListToTrack(name);
    const stirkeIntervalMap: Record<string, number> = {
        NIFTY: 100,
    };
    const instruments = [...futures];
    const strikeInterval = stirkeIntervalMap[name] || 1;
    const strikeLimitPercent = 0.1;
    if (futures.length > 0) {
        const { lastPrice } = futures[0];
        const strikeLimitHigh = lastPrice * (1 + strikeLimitPercent);
        const strikeLimitLow = lastPrice * (1 - strikeLimitPercent);
        for (const expiry of expiryList) {
            const allOptionList = await InstrumentRepository.findInstrumentsBy({
                search: `expiry = :expiry AND 
                         name = :name AND
                         segment = :segment AND
                         strike >= :strikeLimitLow AND strike <= :strikeLimitHigh AND
                         MOD(strike, :strikeInterval) = 0`,
                searchParams: {
                    expiry,
                    name,
                    segment: 'NFO-OPT',
                    strikeLimitHigh,
                    strikeLimitLow,
                    strikeInterval,
                },
                order: { by: 'strike' },
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
        .map((instrument) => instrument.globalSymbol);
}

async function trackInstruments(): Promise<void> {
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

    const topInstruments = await (await InstrumentRepository.findTopInstruments({ exchange: 'NSE', limit: 50 })).map(
        (instrument) => instrument.globalSymbol,
    );
    const fnoInstruments = await getTrackableFnoInstruments();
    const allInstruments = [...indices, ...topInstruments, ...fnoInstruments];

    const result = await InstrumentRepository.trackInstruments(allInstruments);
    Log.info(`Tracking ${result.affected} instruments.`);
}

async function updateLTP(globalSymbols: string[]): Promise<void> {
    const totalInstruments = globalSymbols.length;
    const chunks = lodash.chunk(globalSymbols, 100);
    const bar = new CliProgress.SingleBar(
        { noTTYOutput: true, notTTYSchedule: 5000 },
        CliProgress.Presets.shades_classic,
    );
    bar.start(totalInstruments, 0);
    for (const chunk of chunks) {
        const ltpList: BrokerQuoteLtp[] = await BrokerService.getLTP(chunk);
        await InstrumentRepository.updateInstruments(
            ltpList.map((ltp: Partial<Instrument>) => {
                return { ...ltp, lastPriceUpdatedOn: new Date() };
            }),
        );
        bar.increment(chunk.length);
    }
    bar.stop();
}

async function updateLTPAll(): Promise<void> {
    Log.info('Update all LTP');
    const instruments = await InstrumentRepository.findInstrumentsBy({
        search: 'live = :live AND lastPriceUpdatedOn < :lastPriceUpdatedOnBefore ',
        searchParams: { live: true, lastPriceUpdatedOnBefore: subDays(new Date(), 1) },
    });
    await updateLTP(instruments.map((instrument) => instrument.globalSymbol));
}

async function syncMetaData(): Promise<void> {
    await InstrumentMetaService.syncMetaData();
}

async function getTrackedInstruments(): Promise<Instrument[]> {
    return InstrumentRepository.findInstrumentsBy({ search: { track: true } });
}

async function fetchInstrumentByToken(instrumentToken: string): Promise<Instrument | undefined> {
    const instruments = await InstrumentRepository.findInstrumentsBy({ search: { instrumentToken } });
    if (instruments != undefined && instruments.length > 0) {
        return instruments[0];
    }
}

async function getTrackedFutures(name: string): Promise<Instrument[]> {
    return await InstrumentRepository.findInstrumentsBy({
        search: {
            name,
            segment: 'NFO-FUT',
            track: true,
        },
        order: {
            by: 'expiry',
        },
    });
}

export const InstrumentService = {
    fetchInstrumentByToken,
    syncInstruments,
    syncMetaData,
    updateRanks,
    updateLTPAll,
    trackInstruments,
    getTrackedInstruments,
    getTrackedFutures,
};
