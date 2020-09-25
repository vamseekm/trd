/* eslint-disable @typescript-eslint/no-explicit-any */
import { memoryUsage } from 'process';
import winston, { format } from 'winston';

const logger = winston.createLogger({
    format: format.combine(
        format.errors({ stack: true }),
        format.timestamp({ format: 'HH:mm:ss.SSS' }),
        format.colorize(),
        format.printf((options) => {
            const { level, timestamp, error, message, ...rest } = options;

            const { rss } = memoryUsage();
            const mem = (rss / (1024 * 1024)).toFixed(1).padStart(5, ' ');
            let log = `${process.pid.toString().padStart(4)}|${mem}M|${timestamp}|${level.replace(
                /(nfo|rror|arn)/gi,
                '',
            )}`;
            if (error) {
                if (error.stack) log = `${log}\n${error.stack}`;
                if (process.env.NODE_ENV !== 'production') log = `${log}\n${JSON.stringify(error, undefined, 2)}`;
            }
            log = `${log} ${typeof message == 'object' ? JSON.stringify(message, undefined, 2) : message}`;
            if (!(Object.keys(rest).length === 0 && rest.constructor === Object)) {
                log = `${log}\n${JSON.stringify(rest, undefined, 2)}`;
            }
            const stack = function () {
                const lines = (new Error().stack || '').split('\n').reverse();
                const message = lines[lines.length - 1];
                for (const [i, line] of lines.entries())
                    if (line.includes('winston')) return [message, ...lines.slice(0, i).reverse()].join('\n');
                return lines.join('\n');
            };
            if (level.includes('error')) log = `${log} ${stack()} `;
            return log;
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

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
const pretty = (object: any): void => {
    Log.info(JSON.stringify(object, undefined, 2));
};
export const Log = {
    error,
    info,
    json,
    pretty,
};
