import { Service } from 'typedi';
import { getRepository } from 'typeorm';

import { SymbolMap } from '../entity';

@Service()
export class SymbolMapRepository {
    async symbolList(globalSymbolList: string[]): Promise<SymbolMap[]> {
        return getRepository(SymbolMap)
            .createQueryBuilder()
            .where('globalSymbol IN(:...globalSymbolList)', { globalSymbolList })
            .getMany();
    }

    async generateSymbolMap(globalSymbolList: string[]): Promise<Record<string, SymbolMap>> {
        const databaseSymbolList = await this.symbolList(globalSymbolList);
        const databaseSymbolMap = this.symbolMap(databaseSymbolList);
        const inserts: Partial<SymbolMap>[] = [];
        globalSymbolList.forEach((globalSymbol) => {
            if (globalSymbol == undefined) throw new Error("globalSymbol can't be null");
            if (databaseSymbolMap[globalSymbol] == undefined) inserts.push({ globalSymbol });
        });
        if (inserts.length > 0) {
            await getRepository(SymbolMap).insert(inserts);
            return this.symbolMap(await this.symbolList(globalSymbolList));
        } else {
            return databaseSymbolMap;
        }
    }

    symbolMap(symbolMapList: SymbolMap[]): Record<string, SymbolMap> {
        const symbolMap: Record<string, SymbolMap> = {};
        for (const metaInstrument of symbolMapList) {
            symbolMap[metaInstrument.globalSymbol] = metaInstrument;
        }
        return symbolMap;
    }
}
