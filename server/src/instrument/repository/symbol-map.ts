import { getRepository } from 'typeorm';

import { SymbolMap } from '../entity';

async function generateSymbol(globalSymbol: string): Promise<SymbolMap> {
    const symbolMap = await generateSymbolMap([globalSymbol]);
    return symbolMap[globalSymbol];
}

async function symbolList(globalSymbolList: string[]): Promise<SymbolMap[]> {
    return getRepository(SymbolMap)
        .createQueryBuilder()
        .where('globalSymbol IN(:...globalSymbolList)', { globalSymbolList })
        .getMany();
}

async function generateSymbolMap(globalSymbolList: string[]): Promise<Record<string, SymbolMap>> {
    const databaseSymbolList = await symbolList(globalSymbolList);
    const databaseSymbolMap = symbolMap(databaseSymbolList);
    const inserts: Partial<SymbolMap>[] = [];
    globalSymbolList.forEach((globalSymbol) => {
        if (globalSymbol == undefined) throw new Error("globalSymbol can't be null");
        if (databaseSymbolMap[globalSymbol] == undefined) inserts.push({ globalSymbol });
    });
    if (inserts.length > 0) {
        await getRepository(SymbolMap).insert(inserts);
        return symbolMap(await symbolList(globalSymbolList));
    } else {
        return databaseSymbolMap;
    }
}

function symbolMap(symbolMapList: SymbolMap[]): Record<string, SymbolMap> {
    const symbolMap: Record<string, SymbolMap> = {};
    for (const metaInstrument of symbolMapList) {
        symbolMap[metaInstrument.globalSymbol] = metaInstrument;
    }
    return symbolMap;
}

export const SymbolMapRepository = {
    generateSymbol,
    generateSymbolMap,
};
