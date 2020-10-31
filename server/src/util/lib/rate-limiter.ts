export class RateLimiter {
    delay: number;
    maxDelay: number;
    bufferSize: number;
    constructor({ maxDelay, delay, bufferSize }: { delay: number; maxDelay: number; bufferSize: number }) {
        this.maxDelay = maxDelay;
        this.delay = delay;
        this.bufferSize = bufferSize;
    }

    computeDelayAndBatchSize(totalSize: number): { batchSize: number; delay: number } {
        const batchSize = Math.max(100, Math.floor(totalSize * 0.1));
        if (totalSize > this.bufferSize) this.delay *= 0.9;
        if (totalSize < this.bufferSize) {
            this.delay *= 2.0;
            if (this.delay <= 0) this.delay = 1;
        }
        this.delay = Math.floor(this.delay);
        this.delay = Math.min(this.maxDelay, this.delay);
        this.delay = Math.max(0, this.delay);
        return { batchSize, delay: this.delay };
    }
}
