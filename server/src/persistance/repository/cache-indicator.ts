import { Indicator } from '../../types';
import { CacheGroup } from './cache-group';

const indicatorCache = new CacheGroup('I', true);

async function getIndicators(keys: string[]): Promise<(Indicator | undefined)[]> {
    return indicatorCache.getMulti({ keys });
}
async function setIndicators(indicators: Indicator[]): Promise<Indicator[]> {
    const kvList = indicators.map((indicator) => ({ key: indicator.key, value: indicator }));
    await indicatorCache.setMulti(kvList);
    return indicators;
}
async function writeIndicators(indicators: Indicator[]): Promise<Indicator[]> {
    return setIndicators(indicators);
}

async function flush(): Promise<unknown> {
    return indicatorCache.flush();
}

export const IndicatorCacheRepository = {
    getIndicators,
    writeIndicators,
    flush,
};
