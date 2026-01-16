import type { Context, Next } from 'hono';
import type { Env, Variables } from '../types';

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

class InMemoryRateLimiter {
  private store: Map<string, RateLimitEntry> = new Map();
  private readonly limit: number;
  private readonly windowMs: number;

  constructor(limit: number = 100, windowMs: number = 60000) {
    this.limit = limit;
    this.windowMs = windowMs;
  }

  check(key: string): { allowed: boolean; remaining: number; resetAt: number } {
    const now = Date.now();
    const entry = this.store.get(key);

    if (!entry || entry.resetAt <= now) {
      const resetAt = now + this.windowMs;
      this.store.set(key, { count: 1, resetAt });
      this.cleanup();
      return { allowed: true, remaining: this.limit - 1, resetAt };
    }

    if (entry.count >= this.limit) {
      return { allowed: false, remaining: 0, resetAt: entry.resetAt };
    }

    entry.count++;
    return { allowed: true, remaining: this.limit - entry.count, resetAt: entry.resetAt };
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.store.entries()) {
      if (entry.resetAt <= now) {
        this.store.delete(key);
      }
    }
  }
}

const limiter = new InMemoryRateLimiter(100, 60000);

export async function rateLimitMiddleware(
  c: Context<{ Bindings: Env; Variables: Variables }>,
  next: Next
): Promise<Response | void> {
  const user = c.get('user');
  if (!user) {
    return next();
  }

  const key = `user:${user.id}`;
  const result = limiter.check(key);

  c.header('X-RateLimit-Limit', '100');
  c.header('X-RateLimit-Remaining', result.remaining.toString());
  c.header('X-RateLimit-Reset', Math.floor(result.resetAt / 1000).toString());

  if (!result.allowed) {
    return c.json({
      error: 'Rate limit exceeded',
      resetAt: Math.floor(result.resetAt / 1000),
    }, 429);
  }

  return next();
}
