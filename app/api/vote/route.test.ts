// POST /api/vote unit tests (Task 22).
//
// We exercise the route handler directly with a synthetic Request, against the
// in-memory KV mock + in-memory rate limiter. `__resetKvForTest` /
// `__resetRateLimitForTest` keep tests isolated.

import { beforeEach, describe, expect, it } from 'vitest';

import { POST } from './route';
import {
  __resetKvForTest,
  flipUnlocked,
  getCounts,
} from '@/lib/kv';
import { __resetRateLimitForTest } from '@/lib/rate-limit';

function makeRequest(
  body: unknown,
  opts: { ip?: string; rawBody?: string } = {},
): Request {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (opts.ip) headers['x-forwarded-for'] = opts.ip;
  return new Request('http://test/api/vote', {
    method: 'POST',
    headers,
    body: opts.rawBody !== undefined ? opts.rawBody : JSON.stringify(body),
  });
}

beforeEach(() => {
  __resetKvForTest();
  __resetRateLimitForTest();
});

describe('POST /api/vote — happy path', () => {
  it('returns 200 + {ok, unlocked:false} (no counts pre-unlock) and persists the vote', async () => {
    const res = await POST(
      makeRequest({ matchup: 'raiden', choice: 'old', runId: 'run-1' }),
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toEqual({ ok: true, unlocked: false });
    expect(json.counts).toBeUndefined();

    // KV side-effect happened.
    const counts = await getCounts();
    expect(counts.raiden).toEqual({ old: 1, new: 0, total: 1 });
  });

  it('sets Cache-Control: no-store', async () => {
    const res = await POST(
      makeRequest({ matchup: 'raiden', choice: 'new', runId: 'run-x' }),
    );
    expect(res.headers.get('Cache-Control')).toBe('no-store');
  });
});

describe('POST /api/vote — unlocked board', () => {
  it('includes counts when unlocked', async () => {
    await flipUnlocked();

    const res = await POST(
      makeRequest({ matchup: 'scorpion', choice: 'new', runId: 'run-unlocked' }),
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.unlocked).toBe(true);
    expect(json.counts).toEqual({ old: 0, new: 1 });
  });
});

describe('POST /api/vote — pre-unlock counts omission', () => {
  it('omits counts in the response body when unlocked is false', async () => {
    const res = await POST(
      makeRequest({ matchup: 'kano', choice: 'old', runId: 'run-pre' }),
    );
    expect(res.status).toBe(200);
    const json = (await res.json()) as Record<string, unknown>;
    expect(json.unlocked).toBe(false);
    expect('counts' in json).toBe(false);
  });
});

describe('POST /api/vote — validation', () => {
  it('rejects missing matchup with 400', async () => {
    const res = await POST(makeRequest({ choice: 'old', runId: 'r' }));
    expect(res.status).toBe(400);
  });

  it('rejects missing choice with 400', async () => {
    const res = await POST(makeRequest({ matchup: 'raiden', runId: 'r' }));
    expect(res.status).toBe(400);
  });

  it('rejects missing runId with 400', async () => {
    const res = await POST(makeRequest({ matchup: 'raiden', choice: 'old' }));
    expect(res.status).toBe(400);
  });

  it('rejects unknown matchup with 400', async () => {
    const res = await POST(
      makeRequest({ matchup: 'goro', choice: 'old', runId: 'r' }),
    );
    expect(res.status).toBe(400);
  });

  it('rejects invalid choice with 400', async () => {
    const res = await POST(
      makeRequest({ matchup: 'raiden', choice: 'middle', runId: 'r' }),
    );
    expect(res.status).toBe(400);
  });

  it('rejects empty runId with 400', async () => {
    const res = await POST(
      makeRequest({ matchup: 'raiden', choice: 'old', runId: '' }),
    );
    expect(res.status).toBe(400);
  });

  it('rejects invalid JSON body with 400', async () => {
    const res = await POST(makeRequest(null, { rawBody: '{not valid json' }));
    expect(res.status).toBe(400);
  });
});

describe('POST /api/vote — rate limit', () => {
  it('returns 429 on the 121st request from the same IP and does NOT increment counts', async () => {
    const ip = '9.9.9.9';
    const payload = { matchup: 'raiden', choice: 'old', runId: 'run-rl' };

    // First 120 should succeed.
    for (let i = 0; i < 120; i++) {
      const res = await POST(makeRequest(payload, { ip }));
      expect(res.status).toBe(200);
    }
    const res = await POST(makeRequest(payload, { ip }));
    expect(res.status).toBe(429);

    // Rate-limited request must NOT have incremented the vote counter — only
    // the 120 successful requests landed.
    const counts = await getCounts();
    expect(counts.raiden).toEqual({ old: 120, new: 0, total: 120 });
  });
});
