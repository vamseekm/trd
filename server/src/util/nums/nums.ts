export function truncateFloat(num: number, fixed = 4): number {
    return Number.parseFloat(num.toFixed(fixed));
}
