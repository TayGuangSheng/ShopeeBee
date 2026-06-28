export interface RateLimitDecision {
  allowed: boolean;
  retryAfterMs: number;
  remaining: number;
}

interface RateLimitBucket {
  resetAt: number;
  count: number;
}

export class InMemoryRateLimiter {
  private readonly buckets = new Map<string, RateLimitBucket>();

  public constructor(
    private readonly windowMs: number,
    private readonly maxRequests: number
  ) {}

  public consume(key: string, bypass = false, now = Date.now()): RateLimitDecision {
    if (bypass) {
      return { allowed: true, retryAfterMs: 0, remaining: this.maxRequests };
    }

    this.cleanup(now);

    const existing = this.buckets.get(key);
    if (!existing || existing.resetAt <= now) {
      this.buckets.set(key, { count: 1, resetAt: now + this.windowMs });
      return { allowed: true, retryAfterMs: 0, remaining: this.maxRequests - 1 };
    }

    if (existing.count >= this.maxRequests) {
      return {
        allowed: false,
        retryAfterMs: existing.resetAt - now,
        remaining: 0
      };
    }

    existing.count += 1;
    return {
      allowed: true,
      retryAfterMs: 0,
      remaining: Math.max(0, this.maxRequests - existing.count)
    };
  }

  public reset(key: string): void {
    this.buckets.delete(key);
  }

  private cleanup(now: number): void {
    for (const [key, bucket] of this.buckets.entries()) {
      if (bucket.resetAt <= now) {
        this.buckets.delete(key);
      }
    }
  }
}
