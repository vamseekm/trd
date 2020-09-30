export interface IExchangeConfig {
    name: string;
    startTime: number;
    endTime: number;
    start: {
        hour: number;
        minute: number;
    };
    end: {
        hour: number;
        minute: number;
    };
    dayStartOffset: number;
    dayEndOffset: number;
}

export interface IExchangeTimeProps {
    valid: boolean;
    dayBegin: boolean;
}
