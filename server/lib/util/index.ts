import { from } from 'rxjs';
import { reduce, filter } from 'rxjs/operators';
import { stringify } from 'querystring';

export async function objectArrayToMap<T, K extends keyof T>(items: T[], prop: K): Promise<Record<string, T>> {
    return from(items)
        .pipe(
            reduce((results, item) => {
                const propValue: unknown = item[prop];
                // eslint-disable-next-line no-param-reassign
                results[propValue as string] = item;
                return results;
            }, {} as Record<string, T>),
        )
        .toPromise();
}

export async function arrayToMap(items: string[]): Promise<Record<string, boolean>> {
    return from(items)
        .pipe(
            reduce((results, item) => {
                results[item] = true;
                return results;
            }, {} as Record<string, boolean>),
        )
        .toPromise();
}
