// KV helpers unit tests (Task 20).
//
// All tests exercise the in-memory mock — `KV_REST_API_URL` must be unset
// when this file loads. `__resetKvForTest` throws if it ever ran against a
// real KV, so a misconfigured environment surfaces immediately rather than
// silently truncating production data.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { FIGHTERS } from './fighters';

import {
  REVEAL_AT,
  __resetKvForTest,
  flipUnlocked,
  getCounts,
  getPlays,
  incrementPlays,
  incrementVote,
  isUnlocked,
  markRunSeen,
  releaseSeen,
  seenRun,
} from './kv';

beforeEach(() => {
  __resetKvForTest();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('incrementVote', () => {
  it('returns the running counts after each increment', async () => {
    expect(await incrementVote('raiden', 'old')).toEqual({ old: 1, new: 0 });
    expect(await incrementVote('raiden', 'old')).toEqual({ old: 2, new: 0 });
    expect(await incrementVote('raiden', 'new')).toEqual({ old: 2, new: 1 });
  });

  it('isolates counts per matchup', async () => {
    await incrementVote('raiden', 'old');
    await incrementVote('scorpion', 'new');
    expect(await incrementVote('raiden', 'old')).toEqual({ old: 2, new: 0 });
    expect(await incrementVote('scorpion', 'new')).toEqual({ old: 0, new: 2 });
  });
});

describe('getCounts', () => {
  it('returns all 9 fighters with zeros initially', async () => {
    const counts = await getCounts();
    expect(Object.keys(counts)).toHaveLength(FIGHTERS.length);
    for (const fighter of FIGHTERS) {
      expect(counts[fighter.id]).toEqual({ old: 0, new: 0, total: 0 });
    }
  });

  it('reflects incrementVote results, totals included', async () => {
    await incrementVote('raiden', 'old');
    await incrementVote('raiden', 'old');
    await incrementVote('raiden', 'new');
    await incrementVote('subzero', 'new');

    const counts = await getCounts();
    expect(counts.raiden).toEqual({ old: 2, new: 1, total: 3 });
    expect(counts.subzero).toEqual({ old: 0, new: 1, total: 1 });
    expect(counts.scorpion).toEqual({ old: 0, new: 0, total: 0 });
  });
});

describe('getPlays / incrementPlays', () => {
  it('starts at 0 and increments monotonically', async () => {
    expect(await getPlays()).toBe(0);
    expect(await incrementPlays()).toBe(1);
    expect(await incrementPlays()).toBe(2);
    expect(await incrementPlays()).toBe(3);
    expect(await getPlays()).toBe(3);
  });
});

describe('unlock flip', () => {
  it('isUnlocked is false until flipUnlocked is called explicitly', async () => {
    // Drive plays up to the threshold — the *primitive* doesn't auto-flip.
    // (Threshold-check logic lives in /api/complete, Task 23.)
    for (let i = 0; i < REVEAL_AT; i++) await incrementPlays();
    expect(await isUnlocked()).toBe(false);

    await flipUnlocked();
    expect(await isUnlocked()).toBe(true);
  });

  it('flipUnlocked is idempotent (sticky)', async () => {
    await flipUnlocked();
    await flipUnlocked();
    await flipUnlocked();
    expect(await isUnlocked()).toBe(true);
  });
});

describe('seenRun / markRunSeen / releaseSeen (24h TTL, atomic SET NX)', () => {
  it('returns false before mark, true after mark; first mark returns true', async () => {
    expect(await seenRun('run-abc')).toBe(false);
    const claimed = await markRunSeen('run-abc');
    expect(claimed).toBe(true);
    expect(await seenRun('run-abc')).toBe(true);
  });

  it('markRunSeen is atomic SET NX: second call for the same runId returns false', async () => {
    const first = await markRunSeen('run-nx');
    expect(first).toBe(true);
    expect(await seenRun('run-nx')).toBe(true);

    // SET NX semantics: the slot is already taken, second call MUST return false.
    const second = await markRunSeen('run-nx');
    expect(second).toBe(false);
    const third = await markRunSeen('run-nx');
    expect(third).toBe(false);
    expect(await seenRun('run-nx')).toBe(true);
  });

  it('releaseSeen drops the marker so a subsequent markRunSeen wins the claim again', async () => {
    expect(await markRunSeen('run-rel')).toBe(true);
    expect(await markRunSeen('run-rel')).toBe(false); // already claimed

    await releaseSeen('run-rel');
    expect(await seenRun('run-rel')).toBe(false);

    // After release, re-claim succeeds.
    expect(await markRunSeen('run-rel')).toBe(true);
  });

  it('releaseSeen on a never-claimed runId is a safe no-op', async () => {
    await expect(releaseSeen('run-never')).resolves.toBeUndefined();
    expect(await seenRun('run-never')).toBe(false);
  });

  it('expires after 24 hours via Date.now advancement', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-23T00:00:00Z'));

    expect(await markRunSeen('run-ttl')).toBe(true);
    expect(await seenRun('run-ttl')).toBe(true);

    // 23h59m — still seen.
    vi.setSystemTime(new Date('2026-05-23T23:59:00Z'));
    expect(await seenRun('run-ttl')).toBe(true);

    // 24h + 1s — expired.
    vi.setSystemTime(new Date('2026-05-24T00:00:01Z'));
    expect(await seenRun('run-ttl')).toBe(false);

    // After expiry, re-marking the same runId succeeds (slot is free again).
    expect(await markRunSeen('run-ttl')).toBe(true);
  });

  it('isolates idempotency markers per runId', async () => {
    expect(await markRunSeen('run-1')).toBe(true);
    expect(await seenRun('run-1')).toBe(true);
    expect(await seenRun('run-2')).toBe(false);
    // Claiming run-2 still succeeds — distinct keys.
    expect(await markRunSeen('run-2')).toBe(true);
  });
});

describe('REVEAL_AT', () => {
  it('exposes the threshold as a number', () => {
    expect(typeof REVEAL_AT).toBe('number');
    expect(REVEAL_AT).toBeGreaterThan(0);
  });
});
