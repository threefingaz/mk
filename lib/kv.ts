// KV helpers + in-memory mock fallback (Task 20).
//
// Production: `@vercel/kv` (a thin wrapper around `@upstash/redis`) — picks up
// `KV_REST_API_URL` + `KV_REST_API_TOKEN` from the env, no explicit config.
//
// Local dev / tests: an in-memory mock that implements the subset of methods we
// actually use (`hincrby`, `hgetall`, `incr`, `get`, `set` with `ex`/`nx`). The
// mock is a singleton at module scope so multiple `getKv()` calls in a test
// share state — call `__resetKvForTest()` in `beforeEach` to wipe it.
//
// Mode is decided once at module load (`HAS_REAL_KV`). Tests must run with
// `KV_REST_API_URL` unset; the `__resetKvForTest` guard throws if it isn't, so
// we can't accidentally truncate a real Upstash database.

import { FIGHTERS, type FighterId } from './fighters';

/**
 * True when a real Upstash/Vercel KV connection is configured (via the
 * `KV_REST_API_URL` env var). Used here AND by lib/rate-limit.ts to decide
 * between the production client and the in-memory mock. Exported so the
 * two modules can't drift on what "real KV" means.
 */
export const HAS_REAL_KV = !!process.env.KV_REST_API_URL;

// Default threshold differs by mode: production (real KV) keeps the spec value
// of 30 so the unlock moment is meaningful; local dev (mock KV, no env vars)
// drops to 5 so the unlock flow can be exercised after a handful of completions
// without any configuration. Explicit REVEAL_AT in env always wins.
export const REVEAL_AT = parseInt(
  process.env.REVEAL_AT ?? (HAS_REAL_KV ? '30' : '5'),
  10,
);

// ---------------------------------------------------------------------------
// Mock client — the methods used by this app, nothing more.
// ---------------------------------------------------------------------------

type SetOptions = { ex?: number; nx?: boolean };

interface KvLike {
  hincrby(key: string, field: string, increment: number): Promise<number>;
  hgetall<T extends Record<string, unknown> = Record<string, number>>(
    key: string,
  ): Promise<T | null>;
  incr(key: string): Promise<number>;
  get<T = string>(key: string): Promise<T | null>;
  set(key: string, value: string, options?: SetOptions): Promise<'OK' | null>;
  del(key: string): Promise<number>;
}

class MockKv implements KvLike {
  // Simple values (set/get/incr).
  private values = new Map<string, string>();
  // Hash values (hincrby/hgetall).
  private hashes = new Map<string, Map<string, number>>();
  // Expiration timestamps (ms since epoch). Lazy cleanup on read.
  private expiry = new Map<string, number>();

  reset(): void {
    this.values.clear();
    this.hashes.clear();
    this.expiry.clear();
  }

  // Returns true if the key was expired (and was therefore evicted).
  private expireIfStale(key: string): boolean {
    const exp = this.expiry.get(key);
    if (exp !== undefined && Date.now() > exp) {
      this.values.delete(key);
      this.hashes.delete(key);
      this.expiry.delete(key);
      return true;
    }
    return false;
  }

  async hincrby(key: string, field: string, increment: number): Promise<number> {
    this.expireIfStale(key);
    let hash = this.hashes.get(key);
    if (!hash) {
      hash = new Map();
      this.hashes.set(key, hash);
    }
    const next = (hash.get(field) ?? 0) + increment;
    hash.set(field, next);
    return next;
  }

  async hgetall<T extends Record<string, unknown> = Record<string, number>>(
    key: string,
  ): Promise<T | null> {
    this.expireIfStale(key);
    const hash = this.hashes.get(key);
    if (!hash || hash.size === 0) return null;
    const out: Record<string, number> = {};
    for (const [field, value] of hash) out[field] = value;
    return out as T;
  }

  async incr(key: string): Promise<number> {
    this.expireIfStale(key);
    const current = parseInt(this.values.get(key) ?? '0', 10);
    const next = current + 1;
    this.values.set(key, String(next));
    return next;
  }

  async get<T = string>(key: string): Promise<T | null> {
    this.expireIfStale(key);
    const v = this.values.get(key);
    return (v ?? null) as T | null;
  }

  async set(key: string, value: string, options?: SetOptions): Promise<'OK' | null> {
    this.expireIfStale(key);
    if (options?.nx && this.values.has(key)) return null;
    this.values.set(key, value);
    if (options?.ex !== undefined) {
      this.expiry.set(key, Date.now() + options.ex * 1000);
    } else {
      this.expiry.delete(key);
    }
    return 'OK';
  }

  async del(key: string): Promise<number> {
    this.expireIfStale(key);
    const hadValue = this.values.delete(key);
    const hadHash = this.hashes.delete(key);
    this.expiry.delete(key);
    return hadValue || hadHash ? 1 : 0;
  }
}

// ---------------------------------------------------------------------------
// Client singleton.
// ---------------------------------------------------------------------------

let cached: KvLike | null = null;
let cachedMock: MockKv | null = null;

export function getKv(): KvLike {
  if (cached) return cached;
  if (HAS_REAL_KV) {
    // Lazy require so test runs without env vars don't trigger @vercel/kv's
    // module-level proxy throw.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { kv } = require('@vercel/kv') as typeof import('@vercel/kv');
    cached = kv as unknown as KvLike;
  } else {
    cachedMock = new MockKv();
    cached = cachedMock;
  }
  return cached;
}

/**
 * Test-only: wipe the in-memory mock between tests.
 * Throws if KV_REST_API_URL is set so we can never truncate a real DB.
 */
export function __resetKvForTest(): void {
  if (HAS_REAL_KV) {
    throw new Error('__resetKvForTest called with real KV configured — refusing.');
  }
  // Ensure the singleton is the mock and wipe it.
  if (!cachedMock) {
    cachedMock = new MockKv();
    cached = cachedMock;
  } else {
    cachedMock.reset();
  }
}

// ---------------------------------------------------------------------------
// Helpers used by API routes.
// ---------------------------------------------------------------------------

const ZERO_COUNTS = { old: 0, new: 0 } as const;

function matchupKey(matchup: FighterId): string {
  return `mk:${matchup}`;
}

function asCounts(raw: Record<string, unknown> | null): { old: number; new: number } {
  if (!raw) return { ...ZERO_COUNTS };
  // Upstash returns numbers for hincrby fields, but hgetall can return strings
  // depending on serialization. Coerce defensively.
  const oldVal = raw.old;
  const newVal = raw.new;
  return {
    old: typeof oldVal === 'number' ? oldVal : parseInt(String(oldVal ?? '0'), 10) || 0,
    new: typeof newVal === 'number' ? newVal : parseInt(String(newVal ?? '0'), 10) || 0,
  };
}

export async function incrementVote(
  matchup: FighterId,
  choice: 'old' | 'new',
): Promise<{ old: number; new: number }> {
  const kv = getKv();
  await kv.hincrby(matchupKey(matchup), choice, 1);
  const raw = await kv.hgetall<Record<string, number>>(matchupKey(matchup));
  return asCounts(raw);
}

export async function getCounts(): Promise<
  Record<FighterId, { old: number; new: number; total: number }>
> {
  const kv = getKv();
  const out = {} as Record<FighterId, { old: number; new: number; total: number }>;
  for (const fighter of FIGHTERS) {
    const raw = await kv.hgetall<Record<string, number>>(matchupKey(fighter.id));
    const counts = asCounts(raw);
    out[fighter.id] = { ...counts, total: counts.old + counts.new };
  }
  return out;
}

export async function getPlays(): Promise<number> {
  const kv = getKv();
  const raw = await kv.get<string | number>('mk:plays');
  if (raw === null || raw === undefined) return 0;
  return typeof raw === 'number' ? raw : parseInt(String(raw), 10) || 0;
}

export async function incrementPlays(): Promise<number> {
  const kv = getKv();
  return kv.incr('mk:plays');
}

export async function isUnlocked(): Promise<boolean> {
  const kv = getKv();
  const raw = await kv.get<string | number>('mk:unlocked');
  return String(raw) === '1';
}

export async function flipUnlocked(): Promise<void> {
  const kv = getKv();
  await kv.set('mk:unlocked', '1');
}

export async function seenRun(runId: string): Promise<boolean> {
  const kv = getKv();
  const raw = await kv.get<string | number>(`seen:${runId}`);
  return String(raw) === '1';
}

/**
 * Atomically claim a runId as seen with a 24h TTL. Returns `true` if this
 * caller won the claim (the marker was not previously set), `false` if the
 * marker already exists (a concurrent or prior request beat this one).
 *
 * Used by /api/complete to dedupe retries AND concurrent same-runId requests.
 * The route handler claims FIRST, then performs the increment + unlock-flip;
 * on any failure during those side-effects it calls `releaseSeen(runId)` to
 * drop the marker so the resilience-client retry can re-claim and actually
 * count the play. This is the only ordering that is both idempotent under
 * retry AND safe under concurrent same-runId calls.
 */
export async function markRunSeen(runId: string): Promise<boolean> {
  const kv = getKv();
  const result = await kv.set(`seen:${runId}`, '1', { ex: 60 * 60 * 24, nx: true });
  return result === 'OK';
}

/**
 * Drop a seen-marker that was claimed via `markRunSeen` but whose paired
 * side-effects (incrementPlays / flipUnlocked) failed. Lets the resilience
 * client's retry re-claim and try again. Safe to call even if the marker is
 * already gone — `del` is a no-op on missing keys.
 */
export async function releaseSeen(runId: string): Promise<void> {
  const kv = getKv();
  await kv.del(`seen:${runId}`);
}
