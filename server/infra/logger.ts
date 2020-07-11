import { Service } from 'typedi';
import winston, { format } from 'winston';
import { timestamp } from 'rxjs/operators';
import { parseTwoDigitYear } from 'moment';

const errorStackTracerFormat = winston.format((info) => {
    if (info.meta && info.meta instanceof Error) {
        info.message = `${info.message} ${info.meta.stack}`;
    }
    return info;
});

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
                format.prettyPrint(),
                format.align(),
            ),
            transports: [new winston.transports.Console()],
        });
        this.log = this.logger.log.bind(this.logger);
        this.error = this.logger.error.bind(this.logger);
        this.info = this.logger.info.bind(this.logger);
    }
}
