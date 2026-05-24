// POST /api/complete — run-completion submission (Task 23).
//
// Contract (per plan + Q7/Q8):
//   - Body: { runId: string }
//   - 400 on malformed JSON or missing/invalid runId.
//   - 429 when the per-IP rate limit (5/IP/hr) is exceeded. Clients treat
//     429 as silent — do NOT decorate the body with error messaging.
//   - 200 on idempotent retry: { ok: true, idempotent: true }.
//     The plan suggests a 204 no-op, but 200-with-body gives clients (and
//     diagnostic tooling) a clear signal that the server saw a duplicate.
//   - 200 on success: { ok: true, unlocked, justUnlocked, plays }
//     where `justUnlocked === true` only on the play that crossed REVEAL_AT.
//
// Concurrency / failure model — atomic claim, conditional release on failure:
//   1. `markRunSeen(runId)` is SET NX with a 24h TTL. The first caller to
//      reach this step wins; concurrent same-runId requests see `false` and
//      respond with the idempotent body. This forecloses the
//      check-then-write race that plain SET would allow.
//   2. After winning the claim, we attempt `incrementPlays` then the unlock
//      flip inside a try block. We track an `incremented` flag the instant
//      the increment resolves.
//   3. On throw: release the marker ONLY if `!incremented`. If the increment
//      already counted but the unlock flip then failed, releasing the marker
//      would let a retry double-count. We accept that the unlock flip may be
//      delayed by one completion cycle as the lesser evil.
//
// Known limitations — best-effort, not transactional:
//   - Race A (post-increment release): solved by the `incremented` flag above.
//   - Race B (timed-out client retry): client times out at 8s while the server
//     is still processing the first attempt; the retry hits the server, sees
//     the marker claimed, and returns `idempotent: true`. The client then
//     records hasVoted locally and stops retrying. If the first attempt then
//     fails BEFORE incrementPlays completes, `releaseSeen` drops the marker —
//     but the client is already done, so the play is permanently lost.
//     Truly fixing this requires a Redis transaction (MULTI/EXEC or Lua) so
//     "claim + increment" is atomic. Our KV abstraction doesn't support that
//     today, and the failure window is narrow enough (requires both
//     network-timeout-class server latency AND a pre-increment failure on the
//     first attempt) that we accept it as a known trade-off for a fan poll.
//     See CLAUDE.md "Known limitations" for the contract.
//
// Default Node runtime — same reasoning as /api/vote.

import {
  REVEAL_AT,
  flipUnlocked,
  incrementPlays,
  isUnlocked,
  markRunSeen,
  releaseSeen,
} from '@/lib/kv';
import { checkCompleteRateLimit } from '@/lib/rate-limit';

function bad(message: string): Response {
  return new Response(JSON.stringify({ error: message }), {
    status: 400,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

export async function POST(request: Request): Promise<Response> {
  const body = await request.json().catch(() => null);
  if (body === null || typeof body !== 'object') {
    return bad('invalid json');
  }

  const { runId } = body as { runId?: unknown };

  if (typeof runId !== 'string' || runId.length === 0) {
    return bad('invalid runId');
  }

  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
    request.headers.get('x-real-ip') ??
    '127.0.0.1';

  const rl = await checkCompleteRateLimit(ip);
  if (!rl.success) {
    // Body intentionally minimal — clients swallow 429 silently (Q7/Q8).
    return new Response('Too Many Requests', {
      status: 429,
      headers: { 'Cache-Control': 'no-store' },
    });
  }

  // Atomic claim. SET NX semantics: first writer wins, subsequent same-runId
  // requests get `false` and short-circuit to the idempotent response. This
  // covers both retry-after-success AND concurrent same-runId requests.
  const claimed = await markRunSeen(runId);
  if (!claimed) {
    return Response.json(
      { ok: true, idempotent: true },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  }

  // Side-effects guarded by conditional claim-release.
  //
  // The `incremented` flag is the load-bearing bit: once the counter has been
  // bumped, the play IS counted and the retry path must NOT re-enter (a retry
  // re-claim followed by another increment would double-count). So release
  // only fires when the failure is pre-increment.
  let plays: number;
  let unlocked: boolean;
  let justUnlocked = false;
  let incremented = false;
  try {
    plays = await incrementPlays();
    incremented = true;

    if (plays >= REVEAL_AT && !(await isUnlocked())) {
      await flipUnlocked();
      justUnlocked = true;
    }

    unlocked = await isUnlocked();
  } catch (err) {
    if (!incremented) {
      // Pre-increment failure — release the claim so the retry can re-claim
      // and actually count the play. Swallow any release error (we're already
      // in a failure path; we want to surface the original).
      await releaseSeen(runId).catch(() => {
        // Best-effort cleanup; the 24h TTL will eventually evict the marker
        // even if this release fails.
      });
    }
    // Post-increment failure: marker stays claimed. The play has already been
    // counted; releasing would invite a retry to double-count. The unlock flip
    // (if it was the failing step) is delayed by one completion cycle —
    // acceptable per CLAUDE.md "Known limitations".
    throw err;
  }

  return Response.json(
    { ok: true, unlocked, justUnlocked, plays },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
