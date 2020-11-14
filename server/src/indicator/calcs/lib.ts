import { AbstractIndicatorCalc } from './base';

export function flattenIndicatorDependency(topLevelIndicators: AbstractIndicatorCalc[]): AbstractIndicatorCalc[] {
    const flatIndicatorOrder: AbstractIndicatorCalc[] = [];
    const alreadySeen = new Set<string>();
    for (const topLevelIndicator of topLevelIndicators) {
        const indicatorTreeList = topLevelIndicator.getExecutionOrder();
        for (const subIndicator of indicatorTreeList) {
            if (!alreadySeen.has(subIndicator.id)) {
                flatIndicatorOrder.push(subIndicator);
                alreadySeen.add(subIndicator.id);
            }
        }
    }
    return flatIndicatorOrder;
}
