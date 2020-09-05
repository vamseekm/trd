import CliProgress from 'cli-progress';
import { subDays } from 'date-fns';
import lodash from 'lodash';

import { BrokerService } from '../../broker';
import { Log } from '../../infra';
import { BrokerQuoteLtp } from '../../types';
import { InstrumentClass, InstrumentModel } from '../model';
import { InstrumentRepository } from '../repository/instrument';

async function syncInstruments(): Promise<void> {
    const exchanges = (await BrokerService.getExchanges()).filter((ex) => ex !== 'MF');
    Log.json('Exchange list:', { exchanges });
    for (const exchange of exchanges) {
        try {
            Log.info(`Syncing exchange: ${exchange}`);
            const instruments = await BrokerService.getInstrumentsByExchange(exchange);
            await InstrumentRepository.upsertInstruments(exchange, instruments);
        } catch (error) {
            Log.error(error);
        }
    }
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

async function getFnoInstrumentsToTrack(name: string): Promise<InstrumentClass[]> {
    const futures = await InstrumentRepository.fetchFnoInstruments({ name, segment: 'NFO-FUT', take: 2 });
    const expiryList = await getOptionExpiryListToTrack(name);
    const stirkeIntervalMap: Record<string, number> = {
        NIFTY: 100,
    };
    const instruments: InstrumentClass[] = [...futures];
    const strikeInterval = stirkeIntervalMap[name] || 1;
    const strikeLimitPercent = 0.1;
    if (futures.length > 0) {
        const { lastPrice } = futures[0];
        const strikeLimitHigh = lastPrice * (1 + strikeLimitPercent);
        const strikeLimitLow = lastPrice * (1 - strikeLimitPercent);
        for (const expiry of expiryList) {
            // const allOptionList = await getRepository(Instrument).find({
            const allOptionList = await InstrumentModel.find({
                expiry,
                name,
                segment: 'NFO-OPT',
                strike: {
                    $gte: strikeLimitLow,
                    $lte: strikeLimitHigh,
                    $mod: [strikeInterval, 0],
                },
            }).sort({ strike: 1 });
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

    const topInstruments = (await InstrumentRepository.findTopInstruments({ exchange: 'NSE', take: 50 })).map(
        (instrument) => instrument.globalSymbol,
    );
    const fnoInstruments = await getTrackableFnoInstruments();
    const allInstruments = [...indices, ...topInstruments, ...fnoInstruments];

    await InstrumentRepository.trackInstruments(allInstruments);
    console.log(`Tracking ${allInstruments.length} instruments`);
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
            ltpList.map((ltp: Partial<InstrumentClass>) => {
                return { ...ltp, lastPriceUpdatedOn: new Date() };
            }),
        );
        bar.increment(chunk.length);
    }
    bar.stop();
}

async function updateLTPAll(): Promise<void> {
    const instruments = await InstrumentModel.find(
        { live: true, lastPriceUpdatedOn: { $lt: subDays(new Date(), 1) } },
        'globalSymbol',
    );
    await updateLTP(instruments.map((instrument) => instrument.globalSymbol));
}

async function getTrackedInstruments(): Promise<InstrumentClass[]> {
    return InstrumentModel.find({ track: true });
}

async function fetchInstrumentByToken(instrumentToken: string): Promise<InstrumentClass | null> {
    return InstrumentModel.findOne({ instrumentToken });
}

async function getTrackedFutures(name: string): Promise<InstrumentClass[]> {
    return InstrumentModel.find({ name, segment: 'NFO-FUT', live: true, track: true }).sort({ expiry: 1 });
}

export const InstrumentService = {
    fetchInstrumentByToken,
    syncInstruments,
    updateLTPAll,
    trackInstruments,
    getTrackedInstruments,
    getTrackedFutures,
};
