export class AbstractIndicatorCalc {
    id: string;
    candleFetchCount: number;
    indicatorFetchCount: number;
    private subIndicators: AbstractIndicatorCalc[] = [];

    constructor({
        id,
        prevCandleCount = 1,
        prevIndicatorCount = 1,
    }: {
        id: string;
        prevCandleCount?: number;
        prevIndicatorCount?: number;
    }) {
        this.id = id;
        this.candleFetchCount = prevCandleCount;
        this.indicatorFetchCount = prevIndicatorCount;
    }

    public addSubIndicator(subIndicator: AbstractIndicatorCalc): void {
        this.subIndicators.push(subIndicator);
    }

    public getExecutionOrder(): AbstractIndicatorCalc[] {
        const allSubIndicators: AbstractIndicatorCalc[] = [];
        for (const subIndicator of this.subIndicators) {
            allSubIndicators.push(...subIndicator.getExecutionOrder());
        }
        return [...allSubIndicators, this];
    }
}
