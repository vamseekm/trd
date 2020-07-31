import { memoryUsage } from 'process';
import { Service } from 'typedi';
import winston, { format } from 'winston';

@Service()
export class LoggerService {
    private logger: winston.Logger;

    public log: any;

    public error: any;

    public info: any;

    public json: any;

    constructor() {
        this.logger = winston.createLogger({
            format: format.combine(
                format.errors({ stack: true }),
                format.timestamp({ format: 'HH:mm:ss.SSS' }),
                format.colorize(),
                format.printf((options) => {
                    const { level, timestamp, stack, message } = options;
                    const { rss } = memoryUsage();
                    const mem = (rss / (1024 * 1024)).toFixed(1).padStart(5, ' ');
                    const prefix = `${mem}M|${timestamp}|${level.replace(/(nfo|rror|arn)/gi, '')}| ${message}`;
                    return stack ? `${prefix} ${stack}` : prefix;
                }),
            ),
            transports: [new winston.transports.Console()],
        });
        this.log = this.logger.log.bind(this.logger);
        this.error = this.logger.error.bind(this.logger);
        this.info = this.logger.info.bind(this.logger);
        this.json = (label: any, ...rest: any) => {
            if (rest && rest.length > 0) {
                this.logger.info(`${label}: ${JSON.stringify(rest)}`);
            } else {
                this.logger.info(JSON.stringify(label, undefined, 2));
            }
        };
    }
}
