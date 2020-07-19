import { memoryUsage } from 'process';
import { Service } from 'typedi';
import winston, { format } from 'winston';

@Service()
export class LoggerService {
    private logger: winston.Logger;

    public log: any;

    public error: any;

    public info: any;

    constructor() {
        this.logger = winston.createLogger({
            format: format.combine(
                format.errors({ stack: true }),
                format.timestamp({ format: 'YY/M/D|HH:mm:ss.SSS' }),
                format.colorize(),
                format.printf((options: any) => {
                    const { level, timestamp, stack, message } = options;
                    const { rss } = memoryUsage();
                    const mem = (rss / (1024 * 1024)).toFixed(1);
                    const first = `${timestamp}|${mem}M|${level.replace(/(nfo|rror|arn)/g, '')}| ${message}`;
                    return stack ? `${first} ${stack}` : first;
                }),
            ),
            transports: [new winston.transports.Console()],
        });
        this.log = this.logger.log.bind(this.logger);
        this.error = this.logger.error.bind(this.logger);
        this.info = this.logger.info.bind(this.logger);
    }
}
