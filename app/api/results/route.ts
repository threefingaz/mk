// GET /api/results — crowd-stats read endpoint (Task 24).
//
// Contract (per plan + Q7/Q8):
//   - Response: { unlocked: boolean, plays: number, threshold: number,
//                 stats?: Record<FighterId, { old, new, total }> }
//   - `stats` is omitted pre-unlock — the reveal moment owns first sight of
//     crowd data; leaking it via this endpoint would defeat the design.
//   - No rate limit (Q8 — uncapped read).
//   - Edge cache: `s-maxage=10, stale-while-revalidate=60` — counts are
//     allowed to lag by up to 10 seconds in exchange for a much cheaper hot
//     path on Vercel's CDN. SWR keeps responses warm for slow clients during
//     a regen.
//
// Default Node runtime — matches the other API routes for v1.

import { REVEAL_AT, getCounts, getPlays, isUnlocked } from '@/lib/kv';
import type { FighterId } from '@/lib/fighters';

type Stats = Record<FighterId, { old: number; new: number; total: number }>;

type ResultsPayload = {
  unlocked: boolean;
  plays: number;
  threshold: number;
  stats?: Stats;
};

export async function GET(_request: Request): Promise<Response> {
  void _request;
  const [unlocked, plays] = await Promise.all([isUnlocked(), getPlays()]);

  const payload: ResultsPayload = {
    unlocked,
    plays,
    threshold: REVEAL_AT,
  };

  if (unlocked) {
    payload.stats = await getCounts();
  }

  return Response.json(payload, {
    headers: {
      'Cache-Control': 's-maxage=10, stale-while-revalidate=60',
    },
  });
}
