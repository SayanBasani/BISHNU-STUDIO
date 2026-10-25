// In-memory token bucket rate limiter with automatic cleanup
interface RateLimitRecord {
  count: number;
  resetAt: number;
}

const rateLimitStore = new Map<string, RateLimitRecord>();

// Cleanup stale keys every 5 minutes
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    rateLimitStore.forEach((record, key) => {
      if (now > record.resetAt) {
        rateLimitStore.delete(key);
      }
    });
  }, 5 * 60 * 1000);
}

export interface RateLimitOptions {
  limit: number;
  windowMs: number;
}

export function checkRateLimit(
  identifier: string,
  action: string,
  options: RateLimitOptions = { limit: 10, windowMs: 60 * 1000 }
): { allowed: boolean; remaining: number; retryAfterSec?: number } {
  const key = `${action}:${identifier}`;
  const now = Date.now();
  const record = rateLimitStore.get(key);

  if (!record || now > record.resetAt) {
    rateLimitStore.set(key, {
      count: 1,
      resetAt: now + options.windowMs,
    });
    return { allowed: true, remaining: options.limit - 1 };
  }

  if (record.count >= options.limit) {
    const retryAfterSec = Math.ceil((record.resetAt - now) / 1000);
    return { allowed: false, remaining: 0, retryAfterSec };
  }

  record.count += 1;
  return { allowed: true, remaining: options.limit - record.count };
}
