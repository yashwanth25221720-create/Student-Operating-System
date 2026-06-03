export class TokenBucket {
  private tokens: number;
  private lastRefill: number;

  constructor(
    private readonly capacity: number,
    private readonly refillPerSecond: number
  ) {
    this.tokens = capacity;
    this.lastRefill = Date.now();
  }

  tryRemove(count = 1): boolean {
    this.refill();
    if (this.tokens < count) {
      return false;
    }
    this.tokens -= count;
    return true;
  }

  getAvailable(): number {
    this.refill();
    return Math.floor(this.tokens);
  }

  private refill(): void {
    const now = Date.now();
    const elapsedSeconds = (now - this.lastRefill) / 1000;
    this.tokens = Math.min(this.capacity, this.tokens + elapsedSeconds * this.refillPerSecond);
    this.lastRefill = now;
  }
}

export class ProviderRateLimiter {
  private readonly buckets = new Map<string, TokenBucket>();

  register(providerId: string, requestsPerMinute: number): void {
    this.buckets.set(providerId, new TokenBucket(requestsPerMinute, requestsPerMinute / 60));
  }

  allow(providerId: string): boolean {
    const bucket = this.buckets.get(providerId);
    return bucket ? bucket.tryRemove(1) : true;
  }

  available(providerId: string): number | undefined {
    return this.buckets.get(providerId)?.getAvailable();
  }
}
