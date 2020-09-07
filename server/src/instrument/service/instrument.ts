import { addMonths, subDays } from 'date-fns';
import lodash from 'lodash';

import { BrokerService } from '../../broker';
import { Log } from '../../infra';
import { BrokerQuoteLtp } from '../../types';
import { sleep } from '../../util';
import { Instrument, InstrumentModel } from '../model';
import { InstrumentRepository } from '../repository/instrument';

async function syncInstruments(): Promise<void> {
    const exchanges = (await BrokerService.getExchanges()).filter(
        (exchange) => exchange === 'NSE' || exchange === 'NFO',
    );
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

async function getFnoInstrumentsToTrack(name: string): Promise<Instrument[]> {
    const futures = await InstrumentRepository.fetchFnoInstruments({ name, segment: 'NFO-FUT', take: 2 });
    const expiryList = await getOptionExpiryListToTrack(name);
    const stirkeIntervalMap: Record<string, number> = {
        NIFTY: 100,
    };
    const instruments: Instrument[] = [...futures];
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

    const topInstruments = (
        await InstrumentModel.find({ exchange: 'NSE' }, 'globalSymbol').sort({ rank: 1 }).limit(50)
    ).map((instrument) => instrument.globalSymbol);
    // console.log(topInstruments);
    const fnoInstruments = await getTrackableFnoInstruments();
    // console.log(fnoInstruments);
    const allInstruments = [...indices, ...topInstruments, ...fnoInstruments];

    await InstrumentRepository.trackInstruments(allInstruments);
    console.log(`Tracking ${allInstruments.length} instruments`);
}

async function updateLTP(insrumentList: Instrument[]): Promise<void> {
    const chunks = lodash.chunk(
        insrumentList.map((instrument) => `${instrument.exchange}:${instrument.tradingSymbol}`),
        100,
    );
    for (const [i, chunk] of chunks.entries()) {
        Log.info(`Fetching LTP of chunk: ${i + 1}/${chunks.length}`);
        const ltpList: BrokerQuoteLtp[] = (await BrokerService.getLTP(chunk)).map((item) => {
            return { ...item, globalSymbol: item.globalSymbol.replace(':', '-') };
        });
        // console.log(chunk);
        // console.log(ltpList.filter((item) => item.globalSymbol.match(/nifty/gi)));
        await InstrumentRepository.updateInstruments(
            ltpList.map((ltp: Partial<Instrument>) => {
                return { ...ltp, lastPriceUpdatedOn: new Date() };
            }),
        );
        await sleep(300);
    }
}

async function updateLTPAll(): Promise<void> {
    const maxDate = addMonths(new Date(), 3);
    const instruments = await InstrumentModel.find(
        {
            live: true,
            $and: [
                { expiry: { $lt: maxDate } },
                {
                    $or: [{ lastPriceUpdatedOn: { $lt: subDays(new Date(), 1) } }, { lastPrice: 0 }],
                },
            ],
        },
        'globalSymbol',
    );
    console.log('Updating ltp of :', instruments.length);
    await updateLTP(instruments);
}

async function updateLTPInitialInstruments(): Promise<void> {
    Log.info('Updating LTP of initial instruments...');
    const instruments = await InstrumentModel.find({
        segment: { $in: ['INDICES', 'NFO-FUT', 'NSE'] },
        expiry: { $lt: addMonths(new Date(), 2) },
    });
    await updateLTP(instruments);
    Log.info('\tDone.');
}

async function updateLTPTrackedInstruments(): Promise<void> {
    const trackedInstruments = await InstrumentModel.find({ track: true });
    Log.info(`Updating LTP of ${trackedInstruments.length} tracked instruments...`);
    await updateLTP(trackedInstruments);
    Log.info('\tDone.');
}

async function getTrackedInstruments(): Promise<Instrument[]> {
    return InstrumentModel.find({ track: true });
}

async function fetchInstrumentByToken(instrumentToken: string): Promise<Instrument | null> {
    return InstrumentModel.findOne({ instrumentToken });
}

async function getTrackedFutures(name: string): Promise<Instrument[]> {
    return InstrumentModel.find({ name, segment: 'NFO-FUT', live: true, track: true }).sort({ expiry: 1 }).lean();
}

async function getInstrumentsWithNoLastPrice(): Promise<void> {
    const startTime = new Date();
    const upLimit = addMonths(new Date(), 2);
    const resutls = await InstrumentModel.aggregate([
        { $match: { expiry: { $lt: upLimit }, live: true } },
        { $group: { _id: '$exchange', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
    ]).limit(10);
    console.log('Elapsed:', new Date().getTime() - startTime.getTime());
    console.log(resutls);
}

async function debug(): Promise<void> {
    const instruments = await InstrumentModel.find({ name: 'BANKNIFTY', segment: 'NFO-FUT' });
    console.log(instruments);
    await updateLTP(instruments);
    console.log(await InstrumentModel.find({ globalSymbol: { $in: instruments.map((i) => i.globalSymbol) } }));
}

export const InstrumentService = {
    fetchInstrumentByToken,
    syncInstruments,
    updateLTPAll,
    trackInstruments,
    getTrackedInstruments,
    getTrackedFutures,
    getInstrumentsWithNoLastPrice,
    updateLTPInitialInstruments,
    updateLTPTrackedInstruments,
    debug,
};
