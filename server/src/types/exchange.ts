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

export interface IExchangeTImeProperties {
    valid: boolean;
    dayBegin: boolean;
}
