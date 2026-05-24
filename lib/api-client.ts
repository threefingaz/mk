// Resilience client (Task 25).
//
// Wraps every call to the /api/* endpoints with the documented resilience
// policies from plan Q7:
//
//   - submitVote()    — silent fire-and-forget. Network errors, non-2xx
//                       responses (including 429 rate-limit), and JSON parse
//                       errors all resolve with `{ ok: false }`. No retry, no
//                       throw, no UI surfacing.
//   - submitComplete() — up to 4 attempts with exponential backoff at
//                       500ms / 2s / 5s between attempts (per Q7). Each attempt
//                       is wrapped in an 8s timeout so a stalled request still
//                       reaches the retry path. After the 4th failure resolves
//                       with `{ ok: false, local: true }`. Server-side
//                       `seen:<runId>` dedupe makes the retry sequence safe —
//                       concurrent retries are coalesced server-side, never
//                       double-count.
//   - fetchResults()  — 5s timeout. Any failure (network, abort/timeout,
//                       non-2xx, parse) returns the synthesized fallback
//                       `{ unlocked: false, plays: 0, threshold: 30,
//                       stats: undefined }`. The frontend then paints
//                       pre-unlock UI; the player never sees an error.
//
// All three functions return Promises that NEVER reject. UI code can chain
// `.then()` without `.catch()`.

import type { Era, FighterId } from './fighters';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type VoteResult = {
  ok: boolean;
  unlocked?: boolean;
  counts?: { old: number; new: number };
};

export type CompleteResult = {
  ok: boolean;
  /** True when the call never reached (or never confirmed reaching) the server. */
  local: boolean;
  unlocked?: boolean;
  justUnlocked?: boolean;
  plays?: number;
};

export type ResultsPayload = {
  unlocked: boolean;
  plays: number;
  threshold: number;
  stats?: Record<FighterId, { old: number; new: number; total: number }>;
};

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** Retry delays for submitComplete, in ms. Per Q7: 500ms before attempt 2,
 *  2000ms before attempt 3, 5000ms before attempt 4. The 1st attempt fires
 *  immediately, so 3 backoff intervals support a 4-attempt sequence. */
const COMPLETE_BACKOFFS_MS = [500, 2000, 5000] as const;

const COMPLETE_MAX_ATTEMPTS = 4;

/** Per-attempt timeout for /api/complete fetches. A stalled request without
 *  this would never reach the retry path. 8s leaves room for server-side
 *  processing + a slow network roundtrip. */
const COMPLETE_TIMEOUT_MS = 8_000;

/** Timeout for /api/results. The route is cached and should respond fast;
 *  if it doesn't, the fallback payload is the correct outcome. */
const RESULTS_TIMEOUT_MS = 5_000;

const RESULTS_FALLBACK: ResultsPayload = {
  unlocked: false,
  plays: 0,
  threshold: 30,
  // `stats` deliberately omitted — pre-unlock the UI must not render crowd
  // bars, and `undefined` is the explicit "we have no data" signal.
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Fetch wrapper that aborts after `timeoutMs`. AbortController-backed so the
 * underlying request actually cancels (not just the awaiting promise). On
 * timeout the returned fetch promise rejects with an AbortError, which the
 * caller's existing try/catch treats identically to any other network error.
 */
async function fetchWithTimeout(
  input: RequestInfo,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

// ---------------------------------------------------------------------------
// submitVote — fire-and-forget per-pick.
// ---------------------------------------------------------------------------

export async function submitVote(
  matchup: FighterId,
  choice: Era,
  runId: string,
): Promise<VoteResult> {
  try {
    const res = await fetch('/api/vote', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ matchup, choice, runId }),
    });
    if (!res.ok) {
      // 429, 400, 500, anything non-2xx — silent.
      return { ok: false };
    }
    const parsed = (await res.json()) as Partial<VoteResult>;
    return { ok: true, ...parsed };
  } catch {
    // Network error or parse failure — silent.
    return { ok: false };
  }
}

// ---------------------------------------------------------------------------
// submitComplete — 3× exponential backoff, local-fallback on exhaustion.
// ---------------------------------------------------------------------------

async function tryComplete(runId: string): Promise<CompleteResult | null> {
  try {
    const res = await fetchWithTimeout(
      '/api/complete',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ runId }),
      },
      COMPLETE_TIMEOUT_MS,
    );
    if (!res.ok) return null;
    const parsed = (await res.json()) as Partial<CompleteResult>;
    return { ok: true, local: false, ...parsed };
  } catch {
    // Network error, abort/timeout, or JSON parse failure — treat all the same.
    return null;
  }
}

export async function submitComplete(runId: string): Promise<CompleteResult> {
  for (let attempt = 0; attempt < COMPLETE_MAX_ATTEMPTS; attempt++) {
    // The 1st attempt fires immediately; subsequent attempts wait per
    // COMPLETE_BACKOFFS_MS before firing. Server-side seen:<runId> dedupe
    // makes concurrent/duplicate calls safe.
    if (attempt > 0) {
      await sleep(COMPLETE_BACKOFFS_MS[attempt - 1]);
    }
    const result = await tryComplete(runId);
    if (result !== null) return result;
  }
  // All 4 attempts failed — fall back to local-only completion. The caller
  // has already persisted the local priorRun synchronously (Verdict.tsx),
  // so the player's verdict card survives even though the global play count
  // was not bumped.
  return { ok: false, local: true };
}

// ---------------------------------------------------------------------------
// fetchResults — synthesized fallback on any failure.
// ---------------------------------------------------------------------------

export async function fetchResults(): Promise<ResultsPayload> {
  try {
    const res = await fetchWithTimeout('/api/results', {}, RESULTS_TIMEOUT_MS);
    if (!res.ok) {
      return RESULTS_FALLBACK;
    }
    const parsed = (await res.json()) as ResultsPayload;
    return parsed;
  } catch {
    // Network error, abort/timeout, or JSON parse failure — all fall back.
    return RESULTS_FALLBACK;
  }
}
