import { from } from 'rxjs';
import { reduce } from 'rxjs/operators';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const diff = require('diff-arrays-of-objects');

export async function mapFromObjectList<T, K extends keyof T>(items: T[], prop: K): Promise<Record<string, T>> {
    return from(items)
        .pipe(
            reduce((res, item) => {
                const propValue: unknown = item[prop];
                res[propValue as string] = item;
                return res;
            }, {} as Record<string, T>),
        )
        .toPromise();
}

export async function propMapFromObjectList<T, K extends keyof T>(
    items: T[],
    prop: K,
): Promise<Record<string, number>> {
    return from(items)
        .pipe(
            reduce((res, item, idx) => {
                const propValue: unknown = item[prop];
                res[propValue as string] = idx;
                return res;
            }, {} as Record<string, number>),
        )
        .toPromise();
}

export function diffListOfObjects<T, K extends keyof T>(
    first: T[],
    second: T[],
    prop: K,
): {
    added: T[];
    removed: T[];
    updated: T[];
    same: T[];
    stats: { added: number; removed: number; updated: number; same: number };
} {
    const results = diff(first, second, prop);
    const stats = {
        added: results.added.length,
        removed: results.removed.length,
        updated: results.updated.length,
        same: results.same.length,
    };
    return Object.assign(results, { stats });
}
