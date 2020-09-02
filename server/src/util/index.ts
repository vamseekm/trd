import { spawn } from 'child_process';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const diff = require('diff-arrays-of-objects');

export function mapFromObjectList<T, K extends keyof T>(items: T[], property: K): Record<string, T> {
    const results: Record<string, T> = {};
    for (const item of items) {
        const propertyValue: unknown = item[property];
        results[propertyValue as string] = item;
    }
    return results;
}

export function propertyMapFromObjectList<T, K extends keyof T>(items: T[], property: K): Record<string, number> {
    const results: Record<string, number> = {};
    for (const [index, item] of items.entries()) {
        const propertyValue: unknown = item[property];
        results[propertyValue as string] = index;
    }
    return results;
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

export async function runTask(cmd: string): Promise<any> {
    return new Promise((resolve, reject) => {
        // const fullCmd = `bash ./server.sh --${cmd}`;
        const child = spawn('npm', ['run', 'server', '--', `--${cmd}`, '-x']);
        child.on('exit', (code, signal) => {
            resolve({ code, signal });
        });
        child.on('error', (error) => {
            reject(error);
        });
        child.on('close', () => {
            resolve();
        });
        child.stdout.on('data', (data) => {
            process.stdout.write(data.toString());
        });
        child.stderr.on('data', (data) => {
            process.stdout.write(data.toString());
        });
    });
}

export function currentUnixTimeInMs(): number {
    return new Date().getTime();
}

export function currentUnixTimeInSec(): number {
    return currentUnixTimeInMs() / 1000;
}

export function waitForever(): Promise<any> {
    console.log('Waiting forever...');
    return new Promise(() => {});
}
