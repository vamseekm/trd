/* eslint-disable @typescript-eslint/no-explicit-any */
import { memoryUsage } from 'process';
import winston, { format } from 'winston';

const logger = winston.createLogger({
    format: format.combine(
        format.errors({ stack: true }),
        format.timestamp({ format: 'HH:mm:ss.SSS' }),
        format.colorize(),
        format.printf((options) => {
            const { level, timestamp, stack, message } = options;
            const { rss } = memoryUsage();
            const mem = (rss / (1024 * 1024)).toFixed(1).padStart(5, ' ');
            const prefix = `${process.pid.toString().padStart(4)}|${mem}M|${timestamp}|${level.replace(
                /(nfo|rror|arn)/gi,
                '',
            )}| ${stack ? '' : message}`;
            return stack ? `${prefix} ${stack}` : prefix;
        }),
    ),
    transports: [new winston.transports.Console()],
});

const error = logger.error.bind(logger);
const info = logger.info.bind(logger);
const json = (label: string, ...rest: any[]): void => {
    if (rest && rest.length > 0) {
        Log.info(`${label}: ${JSON.stringify(rest)}`);
    } else {
        Log.info(JSON.stringify(label, undefined, 2));
    }
};

const pretty = (object: any): void => {
    Log.info(JSON.stringify(object, undefined, 2));
};
export const Log = {
    error,
    info,
    json,
    pretty,
};
