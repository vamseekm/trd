import { from } from 'rxjs';
import { reduce } from 'rxjs/operators';

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
