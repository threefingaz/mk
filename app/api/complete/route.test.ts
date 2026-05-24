// POST /api/complete unit tests (Task 23).
//
// Exercises the route handler directly against the in-memory KV mock + the
// in-memory rate limiter. `__resetKvForTest` / `__resetRateLimitForTest` keep
// tests isolated.
//
// REVEAL_AT in this environment depends on the env var; with no override and
// mock-KV mode, it defaults to 5 (dev convenience — see lib/kv.ts). The
// unlock-flip test uses `REVEAL_AT - 1` so it works at any threshold. We drive
// plays up to threshold-1 via the KV primitive, then POST a fresh runId — the
// route handler sees plays === REVEAL_AT and flips. This sidesteps env-stubbing
// the module-level constant.

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { POST } from './route';
import * as kvModule from '@/lib/kv';
import {
  REVEAL_AT,
  __resetKvForTest,
  flipUnlocked,
  getPlays,
  incrementPlays,
  isUnlocked,
  seenRun,
} from '@/lib/kv';
import { __resetRateLimitForTest } from '@/lib/rate-limit';

function makeRequest(
  body: unknown,
  opts: { ip?: string; rawBody?: string } = {},
): Request {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (opts.ip) headers['x-forwarded-for'] = opts.ip;
  return new Request('http://test/api/complete', {
    method: 'POST',
    headers,
    body: opts.rawBody !== undefined ? opts.rawBody : JSON.stringify(body),
  });
}

beforeEach(() => {
  __resetKvForTest();
  __resetRateLimitForTest();
});

describe('POST /api/complete — happy path', () => {
  it('returns 200 with {ok, unlocked:false, justUnlocked:false, plays:1} on first call', async () => {
    const res = await POST(makeRequest({ runId: 'r1' }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toEqual({ ok: true, unlocked: false, justUnlocked: false, plays: 1 });
  });

  it('sets Cache-Control: no-store', async () => {
    const res = await POST(makeRequest({ runId: 'r-cache' }));
    expect(res.headers.get('Cache-Control')).toBe('no-store');
  });
});

describe('POST /api/complete — idempotent retry', () => {
  it('second call with the same runId returns idempotent:true and does NOT bump plays', async () => {
    const first = await POST(makeRequest({ runId: 'r1' }));
    expect(first.status).toBe(200);
    const firstJson = await first.json();
    expect(firstJson.plays).toBe(1);
    expect(await getPlays()).toBe(1);

    const second = await POST(makeRequest({ runId: 'r1' }));
    expect(second.status).toBe(200);
    const secondJson = await second.json();
    expect(secondJson).toEqual({ ok: true, idempotent: true });

    // plays MUST NOT have advanced.
    expect(await getPlays()).toBe(1);
  });
});

describe('POST /api/complete — unlock flip at threshold', () => {
  it('flips unlocked when the completing play crosses REVEAL_AT', async () => {
    // Drive plays up to threshold - 1 directly; the route's increment will be
    // the one that crosses the line.
    for (let i = 0; i < REVEAL_AT - 1; i++) await incrementPlays();
    expect(await getPlays()).toBe(REVEAL_AT - 1);
    expect(await isUnlocked()).toBe(false);

    const res = await POST(makeRequest({ runId: 'r-flip' }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.plays).toBe(REVEAL_AT);
    expect(json.unlocked).toBe(true);
    expect(json.justUnlocked).toBe(true);
    expect(await isUnlocked()).toBe(true);
  });

  it('does NOT report justUnlocked when board is already unlocked', async () => {
    await flipUnlocked();

    const res = await POST(makeRequest({ runId: 'r-already' }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.unlocked).toBe(true);
    expect(json.justUnlocked).toBe(false);
  });
});

describe('POST /api/complete — validation', () => {
  it('rejects missing runId with 400', async () => {
    const res = await POST(makeRequest({}));
    expect(res.status).toBe(400);
  });

  it('rejects empty runId with 400', async () => {
    const res = await POST(makeRequest({ runId: '' }));
    expect(res.status).toBe(400);
  });

  it('rejects non-string runId with 400', async () => {
    const res = await POST(makeRequest({ runId: 123 }));
    expect(res.status).toBe(400);
  });

  it('rejects invalid JSON body with 400', async () => {
    const res = await POST(makeRequest(null, { rawBody: '{not valid json' }));
    expect(res.status).toBe(400);
  });
});

describe('POST /api/complete — rate limit', () => {
  it('returns 429 on the 6th request from the same IP, does NOT bump plays, and does NOT mark runId seen', async () => {
    const ip = '8.8.8.8';
    // First 5 unique runIds succeed.
    for (let i = 0; i < 5; i++) {
      const res = await POST(makeRequest({ runId: `r-rl-${i}` }, { ip }));
      expect(res.status).toBe(200);
    }
    const res = await POST(makeRequest({ runId: 'r-rl-6' }, { ip }));
    expect(res.status).toBe(429);

    // Rate-limited request must NOT have advanced plays beyond the 5 successes.
    expect(await getPlays()).toBe(5);
    // And it must NOT have left an idempotency marker behind.
    expect(await seenRun('r-rl-6')).toBe(false);
  });
});

describe('POST /api/complete — validation rejects before marking runId', () => {
  it('400 with invalid body, then a valid POST with the same intended runId succeeds (plays=1, marker missing before, set after)', async () => {
    // First call: missing runId — should 400, no marker, no plays bump.
    const bad = await POST(makeRequest({}));
    expect(bad.status).toBe(400);
    expect(await getPlays()).toBe(0);

    // Second call: valid runId — succeeds.
    expect(await seenRun('r-valid')).toBe(false);
    const good = await POST(makeRequest({ runId: 'r-valid' }));
    expect(good.status).toBe(200);
    const json = await good.json();
    expect(json.idempotent).toBeUndefined();
    expect(json.plays).toBe(1);
    expect(await seenRun('r-valid')).toBe(true);
  });
});

describe('POST /api/complete — atomic claim + release-on-failure', () => {
  it('if incrementPlays throws, releaseSeen drops the marker so the retry can re-claim and count the play', async () => {
    // First call: marker IS claimed (atomic SET NX), then incrementPlays explodes
    // (transient KV failure). The route MUST release the marker via releaseSeen
    // — otherwise the retry would short-circuit as "idempotent" and the play
    // would be permanently dropped.
    const spy = vi
      .spyOn(kvModule, 'incrementPlays')
      .mockRejectedValueOnce(new Error('transient KV failure'));

    await expect(POST(makeRequest({ runId: 'r-retry' }))).rejects.toThrow(
      'transient KV failure',
    );
    expect(spy).toHaveBeenCalledTimes(1);

    // Critical assertion: marker released after the failure, so the retry is
    // treated as a fresh request and the play is actually counted.
    expect(await seenRun('r-retry')).toBe(false);

    spy.mockRestore();

    // Retry — succeeds, claims the marker fresh, increments plays.
    const retry = await POST(makeRequest({ runId: 'r-retry' }));
    expect(retry.status).toBe(200);
    const json = await retry.json();
    expect(json.plays).toBe(1);
    expect(await getPlays()).toBe(1);
    expect(await seenRun('r-retry')).toBe(true);
  });

  it('idempotent retry after a successful first call returns idempotent:true without bumping plays', async () => {
    // Happy-path retry: SET NX returns null on the second call, route handler
    // emits the idempotent body without touching the counter.
    const first = await POST(makeRequest({ runId: 'r-idem' }));
    expect(first.status).toBe(200);
    expect((await first.json()).plays).toBe(1);

    const second = await POST(makeRequest({ runId: 'r-idem' }));
    expect(second.status).toBe(200);
    expect(await second.json()).toEqual({ ok: true, idempotent: true });
    expect(await getPlays()).toBe(1);
  });

  it('if flipUnlocked throws AFTER incrementPlays succeeded, the marker stays claimed so a retry returns idempotent without re-incrementing', async () => {
    // Race A coverage (see route.ts header "Known limitations"):
    //   - increment succeeds → counter is bumped, play IS counted.
    //   - flipUnlocked then throws → if we released the marker here, a retry
    //     would re-claim and re-increment → DOUBLE COUNT.
    //   - Contract: do NOT release, surface the error, and accept that the
    //     unlock flip is delayed one cycle.
    // Drive plays to threshold - 1 so the next increment crosses REVEAL_AT
    // and triggers the flipUnlocked code path.
    for (let i = 0; i < REVEAL_AT - 1; i++) await incrementPlays();
    expect(await getPlays()).toBe(REVEAL_AT - 1);
    expect(await isUnlocked()).toBe(false);

    const flipSpy = vi
      .spyOn(kvModule, 'flipUnlocked')
      .mockRejectedValueOnce(new Error('transient KV failure'));

    await expect(POST(makeRequest({ runId: 'r-postinc-fail' }))).rejects.toThrow(
      'transient KV failure',
    );

    // Increment ran first — counter already bumped, play IS counted.
    expect(await getPlays()).toBe(REVEAL_AT);
    // Marker MUST NOT have been released — releasing would let a retry
    // re-claim and double-count.
    expect(await seenRun('r-postinc-fail')).toBe(true);
    // Unlock flip failed → still locked. Will flip on the next completion.
    expect(await isUnlocked()).toBe(false);

    flipSpy.mockRestore();

    // Retry with the same runId — short-circuits as idempotent, no further
    // increment. The play was already counted on attempt 1.
    const retry = await POST(makeRequest({ runId: 'r-postinc-fail' }));
    expect(retry.status).toBe(200);
    expect(await retry.json()).toEqual({ ok: true, idempotent: true });
    expect(await getPlays()).toBe(REVEAL_AT);
  });

  it('concurrent same-runId calls only increment plays once (atomic SET NX wins exactly one claim)', async () => {
    // Five simultaneous POSTs with the SAME runId. Without atomic claim
    // semantics, the check-then-write pattern could let multiple callers pass
    // the dedupe check before any marker is written. SET NX forces exactly
    // one winner — the rest get the idempotent body.
    const responses = await Promise.all(
      Array.from({ length: 5 }, () => POST(makeRequest({ runId: 'r-concurrent' }))),
    );

    expect(responses.every((r) => r.status === 200)).toBe(true);
    const bodies = await Promise.all(responses.map((r) => r.json()));
    const successes = bodies.filter((b) => b.idempotent !== true);
    const idempotents = bodies.filter((b) => b.idempotent === true);

    // Exactly one winner; the other four short-circuit on the SET NX miss.
    expect(successes).toHaveLength(1);
    expect(idempotents).toHaveLength(4);
    expect(successes[0].plays).toBe(1);

    // KV counter reflects exactly one increment, no matter how many concurrent
    // callers there were.
    expect(await getPlays()).toBe(1);
    expect(await seenRun('r-concurrent')).toBe(true);
  });
});
