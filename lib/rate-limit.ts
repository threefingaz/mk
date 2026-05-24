// Rate-limit wrapper (Task 21).
//
// Production: `@upstash/ratelimit` sliding-window limiters over the same
// Upstash client `lib/kv.ts` already builds. Per spec (Q8):
//   /api/vote     → 120 requests / IP / hour
//   /api/complete →   5 requests / IP / hour
//   /api/results  → uncapped (no limiter here)
//
// Local dev / tests: a small in-memory limiter implementing the same
// `.limit(ip)` interface. Sliding-window approximation — close enough for
// dev sanity, exact behavior is verified against the Upstash limiter in
// staging.
//
// Both code paths fail-open: if the limiter itself throws (Upstash hiccup,
// network blip), the wrapper returns `success: true` so a flaky rate-limit
// service can never block real users. The route handlers already treat 429
// as silent client-side (Q7/Q8), so the only failure mode that matters is
// the limiter being available at all.

import { Ratelimit } from '@upstash/ratelimit';

import { getKv, HAS_REAL_KV } from './kv';

const VOTE_LIMIT = 120;
const COMPLETE_LIMIT = 5;
const WINDOW_MS = 60 * 60 * 1000; // 1 hour

// ---------------------------------------------------------------------------
// Shared interface — both the real Ratelimit and the in-memory mock implement
// this subset.
// ---------------------------------------------------------------------------

interface LimiterLike {
  limit(ip: string): Promise<{
    success: boolean;
    remaining: number;
    reset: number;
    limit: number;
  }>;
}

// ---------------------------------------------------------------------------
// In-memory limiter for local dev / tests. Sliding-window approximation:
// count requests in the current window; reset when the window elapses.
// ---------------------------------------------------------------------------

class InMemoryLimiter implements LimiterLike {
  private buckets = new Map<string, { count: number; resetAt: number }>();

  constructor(
    private readonly max: number,
    private readonly windowMs: number,
  ) {}

  async limit(ip: string): Promise<{
    success: boolean;
    remaining: number;
    reset: number;
    limit: number;
  }> {
    const now = Date.now();
    let bucket = this.buckets.get(ip);
    if (!bucket || now > bucket.resetAt) {
      bucket = { count: 0, resetAt: now + this.windowMs };
      this.buckets.set(ip, bucket);
    }
    bucket.count += 1;
    const success = bucket.count <= this.max;
    return {
      success,
      remaining: Math.max(0, this.max - bucket.count),
      reset: bucket.resetAt,
      limit: this.max,
    };
  }

  reset(): void {
    this.buckets.clear();
  }
}

// ---------------------------------------------------------------------------
// Limiter singletons. Mode decided once at module load.
// ---------------------------------------------------------------------------

type LimiterEntry = {
  limiter: LimiterLike | null;
  mock: InMemoryLimiter | null;
  max: number;
  prefix: string;
};

const voteEntry: LimiterEntry = { limiter: null, mock: null, max: VOTE_LIMIT, prefix: 'ratelimit:vote' };
const completeEntry: LimiterEntry = { limiter: null, mock: null, max: COMPLETE_LIMIT, prefix: 'ratelimit:complete' };

function getLimiter(entry: LimiterEntry): LimiterLike {
  if (entry.limiter) return entry.limiter;
  if (HAS_REAL_KV) {
    entry.limiter = new Ratelimit({
      // The Ratelimit client expects an @upstash/redis-shaped client; @vercel/kv
      // is a thin subclass of that, so the cast is safe.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      redis: getKv() as any,
      limiter: Ratelimit.slidingWindow(entry.max, '1 h'),
      analytics: false,
      prefix: entry.prefix,
    });
  } else {
    entry.mock = new InMemoryLimiter(entry.max, WINDOW_MS);
    entry.limiter = entry.mock;
  }
  return entry.limiter;
}

// ---------------------------------------------------------------------------
// Public API — what the route handlers call.
// ---------------------------------------------------------------------------

export async function checkVoteRateLimit(ip: string): Promise<{ success: boolean }> {
  try {
    const { success } = await getLimiter(voteEntry).limit(ip);
    return { success };
  } catch {
    // Fail-open: a broken limiter must not block users.
    return { success: true };
  }
}

export async function checkCompleteRateLimit(ip: string): Promise<{ success: boolean }> {
  try {
    const { success } = await getLimiter(completeEntry).limit(ip);
    return { success };
  } catch {
    return { success: true };
  }
}

/**
 * Test-only: fully recreates the in-memory limiters and restores the
 * singleton pointers so a test that swapped limiters via
 * `__setLimitersForTest` is fully reset.
 * Throws when real KV is configured — we never want a test reset to nuke
 * production rate-limit state by accident.
 */
export function __resetRateLimitForTest(): void {
  if (HAS_REAL_KV) {
    throw new Error(
      '__resetRateLimitForTest called with real KV configured — refusing.',
    );
  }
  voteEntry.mock = new InMemoryLimiter(VOTE_LIMIT, WINDOW_MS);
  voteEntry.limiter = voteEntry.mock;
  completeEntry.mock = new InMemoryLimiter(COMPLETE_LIMIT, WINDOW_MS);
  completeEntry.limiter = completeEntry.mock;
}

// Test-only hook: override limiters to exercise the catch path. Internal —
// not part of the public API.
export function __setLimitersForTest(opts: {
  vote?: LimiterLike;
  complete?: LimiterLike;
}): void {
  if (HAS_REAL_KV) {
    throw new Error('__setLimitersForTest called with real KV configured — refusing.');
  }
  if (opts.vote) voteEntry.limiter = opts.vote;
  if (opts.complete) completeEntry.limiter = opts.complete;
}
