import { from } from 'rxjs';
import { reduce } from 'rxjs/operators';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const diff = require('diff-arrays-of-objects');

export async function mapFromObjectList<T, K extends keyof T>(items: T[], property: K): Promise<Record<string, T>> {
    return from(items)
        .pipe(
            reduce((results, item) => {
                const propertyValue: unknown = item[property];
                results[propertyValue as string] = item;
                return results;
            }, {} as Record<string, T>),
        )
        .toPromise();
}

export async function propertyMapFromObjectList<T, K extends keyof T>(
    items: T[],
    property: K,
): Promise<Record<string, number>> {
    return from(items)
        .pipe(
            reduce((results, item, index) => {
                const propertyValue: unknown = item[property];
                results[propertyValue as string] = index;
                return results;
            }, {} as Record<string, number>),
        )
        .toPromise();
}

export function diffListOfObjects<T, K extends keyof T>(
    first: T[],
    second: T[],
    property: K,
): {
    added: T[];
    removed: T[];
    updated: T[];
    same: T[];
    stats: { added: number; removed: number; updated: number; same: number };
} {
    const results = diff(first, second, property);
    const stats = {
        added: results.added.length,
        removed: results.removed.length,
        updated: results.updated.length,
        same: results.same.length,
    };
    return Object.assign(results, { stats });
}
