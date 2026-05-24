// POST /api/vote — per-pick vote submission (Task 22).
//
// Contract (per plan + Q7/Q8):
//   - Body: { matchup: FighterId, choice: 'old' | 'new', runId: string }
//   - 400 on malformed JSON / missing or invalid fields.
//   - 429 when the per-IP rate limit (120/IP/hr) is exceeded. Clients treat
//     429 as silent — do NOT decorate the body with error messaging.
//   - 200 on success: { ok: true, unlocked } always; `counts` added ONLY when
//     the board is already unlocked (pre-unlock crowd data is withheld so the
//     reveal moment retains its punch).
//
// Default Node runtime — `@vercel/kv` works fine here and edge has subtle
// gotchas we don't need to fight in v1.

import {
  incrementVote,
  isUnlocked,
} from '@/lib/kv';
import { checkVoteRateLimit } from '@/lib/rate-limit';
import { FIGHTERS, type FighterId } from '@/lib/fighters';

// Pre-computed Set for O(1) matchup lookup.
const FIGHTER_IDS = new Set<string>(FIGHTERS.map((f) => f.id));

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

  const { matchup, choice, runId } = body as {
    matchup?: unknown;
    choice?: unknown;
    runId?: unknown;
  };

  if (typeof matchup !== 'string' || !FIGHTER_IDS.has(matchup)) {
    return bad('invalid matchup');
  }
  if (choice !== 'old' && choice !== 'new') {
    return bad('invalid choice');
  }
  if (typeof runId !== 'string' || runId.length === 0) {
    return bad('invalid runId');
  }

  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
    request.headers.get('x-real-ip') ??
    '127.0.0.1';

  const rl = await checkVoteRateLimit(ip);
  if (!rl.success) {
    // Body intentionally minimal — clients swallow 429 silently (Q7/Q8).
    return new Response('Too Many Requests', {
      status: 429,
      headers: { 'Cache-Control': 'no-store' },
    });
  }

  const counts = await incrementVote(matchup as FighterId, choice);
  const unlocked = await isUnlocked();

  const payload: { ok: true; unlocked: boolean; counts?: { old: number; new: number } } = {
    ok: true,
    unlocked,
  };
  if (unlocked) payload.counts = counts;

  return Response.json(payload, {
    headers: { 'Cache-Control': 'no-store' },
  });
}
