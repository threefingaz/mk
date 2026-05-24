// Unit tests for the resilience client (Task 25).
//
// We mock `fetch` via vi.fn() and assert:
//   - submitVote: silent on every failure mode (network, 429, non-2xx).
//   - submitComplete: up to 4 attempts with 500ms / 2s / 5s backoffs (Q7);
//     succeeds at any attempt; resolves with {ok:false,local:true} after
//     4 consecutive failures.
//   - fetchResults: returns server payload on 2xx; returns synthesized
//     fallback on any failure mode.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  fetchResults,
  submitComplete,
  submitVote,
  type ResultsPayload,
} from './api-client';

// Vitest provides a per-test `global.fetch`; we install a vi.fn before each
// test and restore between.
let fetchMock: ReturnType<typeof vi.fn>;
const originalFetch = globalThis.fetch;

beforeEach(() => {
  fetchMock = vi.fn();
  globalThis.fetch = fetchMock as unknown as typeof fetch;
});

afterEach(() => {
  vi.useRealTimers();
  globalThis.fetch = originalFetch;
});

// Helper: build a minimal Response-shaped object good enough for our calls.
function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as unknown as Response;
}

// =============================================================================
// submitVote
// =============================================================================

describe('submitVote', () => {
  it('200 OK → returns { ok: true, unlocked: false } and forwards parsed fields', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { ok: true, unlocked: false }));
    const result = await submitVote('raiden', 'old', 'run-1');
    expect(result).toEqual({ ok: true, unlocked: false });
    // Asserts the request shape — POST, JSON, all three body fields.
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/vote');
    expect(init.method).toBe('POST');
    expect(init.headers).toMatchObject({ 'Content-Type': 'application/json' });
    expect(JSON.parse(init.body as string)).toEqual({
      matchup: 'raiden',
      choice: 'old',
      runId: 'run-1',
    });
  });

  it('200 OK with counts → forwards counts in result', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(200, { ok: true, unlocked: true, counts: { old: 12, new: 34 } }),
    );
    const result = await submitVote('scorpion', 'new', 'run-2');
    expect(result).toEqual({ ok: true, unlocked: true, counts: { old: 12, new: 34 } });
  });

  it('429 rate-limit → returns { ok: false } (no throw, no retry)', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(429, null));
    const result = await submitVote('raiden', 'old', 'run-3');
    expect(result).toEqual({ ok: false });
    expect(fetchMock).toHaveBeenCalledTimes(1); // explicitly: NO retry on 429.
  });

  it('500 server error → returns { ok: false }', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(500, null));
    const result = await submitVote('raiden', 'old', 'run-4');
    expect(result).toEqual({ ok: false });
  });

  it('network error (fetch rejects) → returns { ok: false }', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    const result = await submitVote('raiden', 'old', 'run-5');
    expect(result).toEqual({ ok: false });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

// =============================================================================
// submitComplete — up to 4 attempts with 500 / 2000 / 5000 backoffs (Q7).
// =============================================================================

describe('submitComplete', () => {
  it('200 on first attempt → { ok: true, local: false, ...parsed }', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(200, { ok: true, unlocked: false, justUnlocked: false, plays: 1 }),
    );
    const result = await submitComplete('run-A');
    expect(result).toEqual({
      ok: true,
      local: false,
      unlocked: false,
      justUnlocked: false,
      plays: 1,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('fails three times then succeeds on the 4th attempt (advancing fake timers through all three backoffs)', async () => {
    vi.useFakeTimers();

    fetchMock
      .mockResolvedValueOnce(jsonResponse(500, null))
      .mockResolvedValueOnce(jsonResponse(500, null))
      .mockResolvedValueOnce(jsonResponse(500, null))
      .mockResolvedValueOnce(jsonResponse(200, { ok: true, unlocked: true, plays: 30 }));

    const pending = submitComplete('run-B');

    // 1st attempt fires immediately; let microtasks settle.
    await vi.advanceTimersByTimeAsync(0);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // After 1st failure: wait 500ms before 2nd attempt.
    await vi.advanceTimersByTimeAsync(500);
    expect(fetchMock).toHaveBeenCalledTimes(2);

    // After 2nd failure: wait 2000ms before 3rd attempt.
    await vi.advanceTimersByTimeAsync(2000);
    expect(fetchMock).toHaveBeenCalledTimes(3);

    // After 3rd failure: wait 5000ms before 4th attempt.
    await vi.advanceTimersByTimeAsync(5000);
    expect(fetchMock).toHaveBeenCalledTimes(4);

    const result = await pending;
    expect(result).toEqual({ ok: true, local: false, unlocked: true, plays: 30 });
  });

  it('4 consecutive failures → resolves with { ok: false, local: true } and fetches exactly 4 times', async () => {
    vi.useFakeTimers();

    fetchMock
      .mockResolvedValueOnce(jsonResponse(500, null))
      .mockResolvedValueOnce(jsonResponse(500, null))
      .mockResolvedValueOnce(jsonResponse(500, null))
      .mockResolvedValueOnce(jsonResponse(500, null));

    const pending = submitComplete('run-C');

    // Drain all backoff waits: 500ms + 2000ms + 5000ms.
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(500);
    await vi.advanceTimersByTimeAsync(2000);
    await vi.advanceTimersByTimeAsync(5000);

    const result = await pending;
    expect(result).toEqual({ ok: false, local: true });
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it('treats fetch-throws the same as non-2xx (4 throws → local fallback)', async () => {
    vi.useFakeTimers();

    fetchMock
      .mockRejectedValueOnce(new TypeError('offline'))
      .mockRejectedValueOnce(new TypeError('offline'))
      .mockRejectedValueOnce(new TypeError('offline'))
      .mockRejectedValueOnce(new TypeError('offline'));

    const pending = submitComplete('run-D');
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(500);
    await vi.advanceTimersByTimeAsync(2000);
    await vi.advanceTimersByTimeAsync(5000);

    const result = await pending;
    expect(result).toEqual({ ok: false, local: true });
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it('stalled fetch (never resolves) aborts at 8s timeout and retries on the next attempt', async () => {
    vi.useFakeTimers();

    // First attempt: fetch attaches an abort listener to init.signal and
    // never resolves on its own. The 8s AbortController timeout fires, the
    // controller aborts, the fetch promise rejects with an AbortError. The
    // retry succeeds.
    fetchMock.mockImplementation(((_input: RequestInfo, init: RequestInit) => {
      // Second mock call: success response, no stalling.
      if (fetchMock.mock.calls.length === 2) {
        return Promise.resolve(jsonResponse(200, { ok: true, plays: 1 }));
      }
      // First mock call: stall + listen for abort. Mirrors browser fetch
      // semantics — AbortController-cancelled requests reject with AbortError.
      return new Promise((_res, rej) => {
        init.signal?.addEventListener('abort', () => {
          rej(new DOMException('The operation was aborted.', 'AbortError'));
        });
      });
    }) as unknown as typeof fetch);

    const pending = submitComplete('run-stall');

    // Microtasks settle — fetch is in-flight (no response yet).
    await vi.advanceTimersByTimeAsync(0);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // Advance to 8s — the timeout fires, controller aborts, fetch rejects.
    // tryComplete catches the AbortError, returns null. submitComplete then
    // waits 500ms before attempt 2.
    await vi.advanceTimersByTimeAsync(8_000);
    // Backoff delay before retry.
    await vi.advanceTimersByTimeAsync(500);
    expect(fetchMock).toHaveBeenCalledTimes(2);

    const result = await pending;
    expect(result).toEqual({ ok: true, local: false, plays: 1 });
  });

  it('fetchResults aborts at 5s timeout and returns the synthesized fallback', async () => {
    vi.useFakeTimers();

    fetchMock.mockImplementation(((_input: RequestInfo, init: RequestInit) => {
      return new Promise((_res, rej) => {
        init.signal?.addEventListener('abort', () => {
          rej(new DOMException('The operation was aborted.', 'AbortError'));
        });
      });
    }) as unknown as typeof fetch);

    const pending = fetchResults();
    await vi.advanceTimersByTimeAsync(0);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // 5s timeout fires; the abort-listening promise rejects, fetchResults
    // catches it, returns the fallback. No retry — fetchResults is a single
    // shot.
    await vi.advanceTimersByTimeAsync(5_000);
    const result = await pending;
    expect(result).toEqual({ unlocked: false, plays: 0, threshold: 30 });
  });
});

// =============================================================================
// fetchResults
// =============================================================================

describe('fetchResults', () => {
  const FALLBACK: ResultsPayload = {
    unlocked: false,
    plays: 0,
    threshold: 30,
  };

  it('200 with payload → returns the parsed payload verbatim', async () => {
    const payload: ResultsPayload = {
      unlocked: true,
      plays: 42,
      threshold: 30,
      stats: {
        raiden: { old: 1, new: 2, total: 3 },
        liukang: { old: 4, new: 5, total: 9 },
        johnnycage: { old: 0, new: 0, total: 0 },
        sonya: { old: 0, new: 0, total: 0 },
        kitana: { old: 0, new: 0, total: 0 },
        shangtsung: { old: 0, new: 0, total: 0 },
        kano: { old: 0, new: 0, total: 0 },
        scorpion: { old: 0, new: 0, total: 0 },
        subzero: { old: 0, new: 0, total: 0 },
      },
    };
    fetchMock.mockResolvedValueOnce(jsonResponse(200, payload));
    const result = await fetchResults();
    expect(result).toEqual(payload);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe('/api/results');
  });

  it('network error → returns synthesized fallback { unlocked:false, plays:0, threshold:30 }', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    const result = await fetchResults();
    expect(result).toEqual(FALLBACK);
    expect(result.stats).toBeUndefined();
  });

  it('500 server error → returns synthesized fallback', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(500, null));
    const result = await fetchResults();
    expect(result).toEqual(FALLBACK);
  });

  it('JSON parse error → returns synthesized fallback', async () => {
    const badResponse = {
      ok: true,
      status: 200,
      json: async () => {
        throw new SyntaxError('Unexpected end of JSON');
      },
    } as unknown as Response;
    fetchMock.mockResolvedValueOnce(badResponse);
    const result = await fetchResults();
    expect(result).toEqual(FALLBACK);
  });
});
