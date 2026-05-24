// GET /api/results unit tests (Task 24).
//
// Exercises the handler against the in-memory KV mock. Pre-unlock branch must
// omit `stats` entirely (key absence, not `stats: {}`); post-unlock branch must
// return all 9 fighters with `{ old, new, total }` shape.

import { beforeEach, describe, expect, it } from 'vitest';

import { GET } from './route';
import {
  REVEAL_AT,
  __resetKvForTest,
  flipUnlocked,
  incrementPlays,
  incrementVote,
} from '@/lib/kv';
import { FIGHTERS } from '@/lib/fighters';

function makeRequest(): Request {
  return new Request('http://test/api/results', { method: 'GET' });
}

beforeEach(() => {
  __resetKvForTest();
});

describe('GET /api/results — pre-unlock', () => {
  it('returns 200 with {unlocked:false, plays:0, threshold} and NO stats key', async () => {
    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    const json = await res.json();

    expect(json.unlocked).toBe(false);
    expect(json.plays).toBe(0);
    expect(json.threshold).toBe(REVEAL_AT);
    // stats MUST be absent (not `{}`) so clients can distinguish locked from
    // unlocked-with-zero-data via the key's presence.
    expect('stats' in json).toBe(false);
  });

  it('reflects play count even while locked', async () => {
    await incrementPlays();
    await incrementPlays();
    await incrementPlays();

    const res = await GET(makeRequest());
    const json = await res.json();
    expect(json.unlocked).toBe(false);
    expect(json.plays).toBe(3);
    expect('stats' in json).toBe(false);
  });
});

describe('GET /api/results — post-unlock', () => {
  it('returns stats with all 9 fighters populated when unlocked', async () => {
    await flipUnlocked();
    // Cast a few votes for raiden.
    await incrementVote('raiden', 'old');
    await incrementVote('raiden', 'old');
    await incrementVote('raiden', 'new');

    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    const json = await res.json();

    expect(json.unlocked).toBe(true);
    expect(json.stats).toBeDefined();

    // Raiden has the seeded votes.
    expect(json.stats.raiden).toEqual({ old: 2, new: 1, total: 3 });

    // All 9 fighters must be present in the response (untouched fighters
    // surface as zeros, not undefined keys).
    for (const f of FIGHTERS) {
      expect(json.stats[f.id]).toBeDefined();
      expect(typeof json.stats[f.id].old).toBe('number');
      expect(typeof json.stats[f.id].new).toBe('number');
      expect(typeof json.stats[f.id].total).toBe('number');
    }
  });

  it('zero-vote fighters report {old:0, new:0, total:0}', async () => {
    await flipUnlocked();
    const res = await GET(makeRequest());
    const json = await res.json();
    expect(json.unlocked).toBe(true);
    for (const f of FIGHTERS) {
      expect(json.stats[f.id]).toEqual({ old: 0, new: 0, total: 0 });
    }
  });
});

describe('GET /api/results — shape correctness', () => {
  it('top-level keys + types are stable pre-unlock', async () => {
    const res = await GET(makeRequest());
    const json = await res.json();
    expect(typeof json.unlocked).toBe('boolean');
    expect(typeof json.plays).toBe('number');
    expect(typeof json.threshold).toBe('number');
  });

  it('top-level keys + types are stable post-unlock', async () => {
    await flipUnlocked();
    const res = await GET(makeRequest());
    const json = await res.json();
    expect(typeof json.unlocked).toBe('boolean');
    expect(typeof json.plays).toBe('number');
    expect(typeof json.threshold).toBe('number');
    expect(typeof json.stats).toBe('object');
    expect(json.stats).not.toBeNull();
  });
});

describe('GET /api/results — cache headers', () => {
  it('sets s-maxage=10, stale-while-revalidate=60', async () => {
    const res = await GET(makeRequest());
    expect(res.headers.get('Cache-Control')).toBe(
      's-maxage=10, stale-while-revalidate=60',
    );
  });

  it('cache header is set post-unlock too', async () => {
    await flipUnlocked();
    const res = await GET(makeRequest());
    expect(res.headers.get('Cache-Control')).toBe(
      's-maxage=10, stale-while-revalidate=60',
    );
  });
});
