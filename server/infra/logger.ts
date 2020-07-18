import { Service } from 'typedi';
import winston, { format } from 'winston';
import { memoryUsage } from 'process';

@Service()
export class Logger {
    private logger: winston.Logger;

    public log: any;

    public error: any;

    public info: any;

    constructor() {
        this.logger = winston.createLogger({
            format: format.combine(
                format.errors({ stack: true }),
                format.timestamp(),
                format.colorize(),
                format.printf(({ level, message, timestamp, stack }: any) => {
                    const { rss } = memoryUsage();
                    const mem = (rss / (1024 * 1024)).toFixed(2);
                    if (stack) {
                        // print log trace
                        return `${timestamp} [${mem} MiB] ${level}: ${message} - ${stack}`;
                    }
                    return `${timestamp} [${mem} MiB] ${level}: ${message}`;
                }),
            ),
            transports: [new winston.transports.Console()],
        });
        this.log = this.logger.log.bind(this.logger);
        this.error = this.logger.error.bind(this.logger);
        this.info = this.logger.info.bind(this.logger);
    }
}
