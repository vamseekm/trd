import { spawn } from 'child_process';
import CliProgress from 'cli-progress';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const diff = require('diff-arrays-of-objects');

export function mapFromObjectList<T, K extends keyof T>(items: T[], property: K): Map<T[K], T> {
    const map = new Map<T[K], T>();
    for (const item of items) map.set(item[property], item);
    return map;
}

export function propertyMapFromObjectList<T, K extends keyof T>(items: T[], property: K): Record<string, number> {
    const results: Record<string, number> = {};
    for (const [index, item] of items.entries()) {
        const propertyValue = item[property];
        results[propertyValue as any] = index;
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

export function forever(): Promise<any> {
    console.log('Waiting forever...');
    return new Promise(() => {});
}

export async function progressbar(): Promise<CliProgress.SingleBar> {
    return new CliProgress.SingleBar({ noTTYOutput: true, notTTYSchedule: 5000 }, CliProgress.Presets.shades_classic);
}

export function toSetAndMap<T, K extends keyof T>(items: T[], key: K): { set: Set<T[K]>; map: Map<T[K], T> } {
    const set = new Set<T[K]>();
    const map = new Map<T[K], T>();
    for (const item of items) {
        set.add(item[key]);
        map.set(item[key], item);
    }
    return { set, map };
}
