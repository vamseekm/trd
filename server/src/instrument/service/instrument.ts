import lodash from 'lodash';
import { DateTime } from 'luxon';
import { Op, Sequelize } from 'sequelize';

import { BrokerService } from '../../broker';
import { InstrumentModel, InstrumentRepository } from '../../database';
import { CacheRepository } from '../../database';
import { Log } from '../../infra';
import { BrokerQuoteLtp, IInstrument, INSTRUMENT_ID_SEPERATOR } from '../../types';
import { sleep } from '../../util';

async function syncInstruments(): Promise<void> {
    const exchanges = (await BrokerService.getExchanges()).filter(
        (exchange) => exchange === 'NSE' || exchange === 'NFO',
    );
    Log.json('Exchange list:', { exchanges });
    for (const exchange of exchanges) {
        try {
            Log.info(`Syncing exchange: ${exchange}`);
            const instruments = await BrokerService.getInstrumentsByExchange(exchange);
            Log.info(`\tFetched ${instruments.length} instruments...`);
            console.log(await InstrumentRepository.upsertInstruments(exchange, instruments));
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

async function getFnoInstrumentsToTrack(name: string): Promise<IInstrument[]> {
    const futures = await InstrumentRepository.fetchFnoInstruments({ name, segment: 'NFO-FUT', take: 2 });
    const expiryList = await getOptionExpiryListToTrack(name);
    //TODO: Config
    const stirkeIntervalMap: Record<string, number> = {
        NIFTY: 100,
        BANKNIFTY: 100,
    };
    const instruments: IInstrument[] = [...futures];
    const strikeInterval = stirkeIntervalMap[name] || 1;
    const strikeLimitPercent = 0.1;
    if (futures.length > 0) {
        const { lastPrice } = futures[0];
        const strikeLimitHigh = lastPrice * (1 + strikeLimitPercent);
        const strikeLimitLow = lastPrice * (1 - strikeLimitPercent);
        for (const expiry of expiryList) {
            const allOptionList = await InstrumentModel.findAll({
                where: {
                    [Op.and]: [
                        { expiry },
                        { name },
                        { segment: 'NFO-OPT' },
                        {
                            strike: {
                                [Op.gte]: strikeLimitLow,
                                [Op.lte]: strikeLimitHigh,
                            },
                        },
                        Sequelize.where(
                            Sequelize.fn(
                                'mod',
                                Sequelize.cast(Sequelize.col('strike'), 'numeric'),
                                Sequelize.literal(`${strikeInterval}`),
                            ),
                            Sequelize.literal('0'),
                        ),
                    ],
                },
                order: [['strike', 'ASC']],
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
        await InstrumentModel.findAll({
            where: { exchange: 'NSE' },
            attributes: ['id'],
            order: [['rank', 'ASC']],
            limit: 50,
        })
    ).map((instrument) => instrument.id);
    const fnoInstruments = await getTrackableFnoInstruments();
    const allInstruments = [...indices, ...topInstruments, ...fnoInstruments];
    Log.json('Tracking:', {
        indices: indices.length,
        topInstruments: topInstruments.length,
        fnoInstruments: fnoInstruments.length,
    });

    const alreadyTrackedIds = await InstrumentRepository.getAutoTrackedInstrumentIds();
    Log.info(`\tUntracking previously tracked ${alreadyTrackedIds.length} instruments.`);
    await InstrumentRepository.trackInstruments(alreadyTrackedIds, false);
    await InstrumentRepository.trackInstruments(allInstruments, true);
    Log.info(`\tTracking ${allInstruments.length} instruments.`);
}

async function updateLTP(insrumentList: IInstrument[]): Promise<void> {
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
            ltpList.map((ltp: Partial<IInstrument>) => {
                return { ...ltp, lastPriceUpdatedOn: new Date() };
            }),
        );
        await sleep(300);
    }
}

async function updateLTPAll(): Promise<void> {
    const maxDate = DateTime.local().plus({ month: 3 }).toJSDate();
    const updatedBefore = DateTime.local().minus({ day: 1 }).toJSDate();
    const instruments = await InstrumentModel.findAll({
        attributes: ['id'],
        where: {
            live: true,
            [Op.and]: [
                { expiry: { [Op.lt]: maxDate } },
                {
                    [Op.or]: [{ lastPriceUpdatedOn: { [Op.lt]: updatedBefore } }, { lastPrice: 0 }],
                },
            ],
        },
    });
    console.log('Updating ltp of :', instruments.length);
    await updateLTP(instruments);
}

async function updateLTPInitialInstruments(): Promise<void> {
    Log.info('Updating LTP of initial instruments...');
    const expireBefore = DateTime.local().plus({ month: 2 }).toJSDate();
    const instruments = await InstrumentModel.findAll({
        where: {
            segment: { [Op.in]: ['INDICES', 'NFO-FUT', 'NSE'] },
            expiry: { [Op.lt]: expireBefore },
        },
    });
    await updateLTP(instruments);
    Log.info('\tDone.');
}

async function updateLTPTrackedInstruments(): Promise<void> {
    const trackedInstruments = await InstrumentModel.findAll({ where: { track: true } });
    Log.info(`Updating LTP of ${trackedInstruments.length} tracked instruments...`);
    await updateLTP(trackedInstruments);
    Log.info('\tDone.');
}

async function getTrackedInstruments(): Promise<IInstrument[]> {
    return InstrumentModel.findAll({ where: { track: true } });
}

async function fetchInstrumentByToken(instrumentToken: string): Promise<IInstrument | null> {
    return InstrumentModel.findOne({ where: { instrumentToken }, raw: true });
}

async function getTrackedFutures(name: string): Promise<IInstrument[]> {
    return InstrumentModel.findAll({
        where: { name, segment: 'NFO-FUT', live: true, track: true },
        order: [['expiry', 'ASC']],
    });
}

async function debug(): Promise<void> {
    const ins = await CacheRepository.getInstrumentById('NSE_SBIN');
    console.log(ins);
}

export const InstrumentService = {
    fetchInstrumentByToken,
    syncInstruments,
    updateLTPAll,
    trackInstruments,
    getTrackedInstruments,
    getTrackedFutures,
    updateLTPInitialInstruments,
    updateLTPTrackedInstruments,
    debug,
};
