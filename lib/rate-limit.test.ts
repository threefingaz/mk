// Rate-limit wrapper unit tests (Task 21).
//
// All tests exercise the in-memory limiter — `KV_REST_API_URL` must be unset
// when this file loads. `__resetRateLimitForTest` throws if it ever ran against
// real KV, so a misconfigured environment surfaces immediately.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  __resetRateLimitForTest,
  __setLimitersForTest,
  checkCompleteRateLimit,
  checkVoteRateLimit,
} from './rate-limit';

beforeEach(() => {
  __resetRateLimitForTest();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('checkVoteRateLimit', () => {
  it('allows 120 requests then blocks the 121st', async () => {
    const ip = '1.1.1.1';
    for (let i = 0; i < 120; i++) {
      const { success } = await checkVoteRateLimit(ip);
      expect(success).toBe(true);
    }
    const { success } = await checkVoteRateLimit(ip);
    expect(success).toBe(false);
  });

  it('isolates buckets per IP', async () => {
    for (let i = 0; i < 120; i++) {
      const { success } = await checkVoteRateLimit('a');
      expect(success).toBe(true);
    }
    // 'a' is exhausted, but 'b' should still be fresh.
    expect((await checkVoteRateLimit('a')).success).toBe(false);
    expect((await checkVoteRateLimit('b')).success).toBe(true);
  });

  it('resets after the window elapses', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-23T00:00:00Z'));

    const ip = '3.3.3.3';
    for (let i = 0; i < 120; i++) {
      await checkVoteRateLimit(ip);
    }
    expect((await checkVoteRateLimit(ip)).success).toBe(false);

    // Advance 1h + 1s — next call should succeed again.
    vi.setSystemTime(new Date('2026-05-23T01:00:01Z'));
    expect((await checkVoteRateLimit(ip)).success).toBe(true);
  });
});

describe('checkCompleteRateLimit', () => {
  it('allows 5 requests then blocks the 6th', async () => {
    const ip = '2.2.2.2';
    for (let i = 0; i < 5; i++) {
      const { success } = await checkCompleteRateLimit(ip);
      expect(success).toBe(true);
    }
    const { success } = await checkCompleteRateLimit(ip);
    expect(success).toBe(false);
  });
});

describe('fail-open resilience', () => {
  it('returns success: true when the underlying limiter throws', async () => {
    __setLimitersForTest({
      vote: {
        limit: async () => {
          throw new Error('upstash unavailable');
        },
      },
      complete: {
        limit: async () => {
          throw new Error('upstash unavailable');
        },
      },
    });

    expect((await checkVoteRateLimit('x')).success).toBe(true);
    expect((await checkCompleteRateLimit('x')).success).toBe(true);
  });
});
