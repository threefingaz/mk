// Run-result derivation (Task 10).
//
// Pure function that turns a finished run (9 picks + the shuffled order +
// optional crowd data) into the verdict-card payload: oldPicks, newPicks,
// per-fighter pick rows with crowd majority, contrarian (defied) count,
// archetype, runId, and a UTC YYYY.MM.DD date string.
//
// `defied` and per-row `majority` are null pre-unlock or whenever crowd data
// for a given fighter is missing — there's nothing to compare against.

import { archetypeFor, type Archetype } from './archetype';
import { FIGHTERS, type Era, type FighterId } from './fighters';

export type { Era };

export type PickRow = {
  fighter: FighterId;
  choice: Era;
  /** null pre-unlock or when no crowd data exists for that fighter. */
  majority: Era | null;
};

export type CrowdStats = Record<FighterId, { old: number; new: number; total: number }>;

export type RunResult = {
  oldPicks: number;
  newPicks: number;
  picks: PickRow[];
  /** null pre-unlock (no crowd data to compare against). */
  defied: number | null;
  archetype: Archetype;
  runId: string;
  /** UTC, formatted YYYY.MM.DD */
  date: string;
};

export type ComputeRunResultInput = {
  /** length 9; the player's pick per duel, in the order they played. */
  picks: Era[];
  /** length 9; shuffled fighter indices for the session. picks[i] applies to FIGHTERS[order[i]]. */
  order: number[];
  /** Map of fighter id → counts. null when not unlocked or fetch failed. */
  crowdStats: Partial<CrowdStats> | null;
  /** Whether the global scoreboard is unlocked. */
  unlocked: boolean;
  runId: string;
  /** Optional injection for testing; defaults to today's date in UTC, formatted YYYY.MM.DD. */
  date?: string;
};

/**
 * Format a Date as YYYY.MM.DD in UTC.
 *
 * UTC is the right choice here: the verdict card date is part of the
 * shareable artifact, and a player sharing across timezones shouldn't see a
 * different date stamped on their own card than what their friend sees.
 */
export function formatUtcDate(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}.${m}.${day}`;
}

/** Today's date in UTC, formatted as YYYY.MM.DD. */
export function todayUtc(): string {
  return formatUtcDate(new Date());
}

/**
 * Canonical FIGHTERS order ([0..8]). Used when reconstructing a synthetic
 * run result from a share code (the original session's shuffle order isn't
 * encoded — share codes carry picks in this canonical order).
 */
export const CANONICAL_ORDER: readonly number[] = [0, 1, 2, 3, 4, 5, 6, 7, 8];

/**
 * Sentinel runId used when reconstructing a RunResult from a share code.
 * The original session's runId isn't part of the code, so synthetic results
 * (rendered by /r/[code] and /api/og) carry this fixed value instead.
 */
export const SHARED_RESULT_RUN_ID = 'shared';

/**
 * The "dominant era" CSS class to apply to a result surface — the screen
 * background switches between `era-old` and `era-new` based on which side the
 * player leaned. Ties (when oldPicks === newPicks would be impossible since
 * 9 is odd; the >=5 threshold formalizes the lean direction).
 *
 * Centralized so Verdict, Share, ReturningVisitor, and /r/[code] stay in
 * lockstep — a one-line helper, but flipping the threshold in one place
 * beats hunting for stragglers.
 */
export function dominantEraClass(oldPicks: number): 'era-old' | 'era-new' {
  return oldPicks >= 5 ? 'era-old' : 'era-new';
}

/**
 * Compute the crowd majority for a single fighter's counts.
 *
 * Tiebreaker (counts.old === counts.new) returns 'old'. This is deterministic
 * and intentional — ties are rare in practice and treating them as 'old'
 * matches the "old guard incumbent" framing of the spec. Crucially, the tie
 * tiebreaker fires for the zero/zero case too, but those rows are filtered out
 * upstream by the `total === 0 → majority null` rule, so this only matters
 * when a real, equal split exists.
 */
function majorityOf(counts: { old: number; new: number; total: number }): Era {
  return counts.old >= counts.new ? 'old' : 'new';
}

/**
 * Pure derivation: 9 picks + run context → verdict-card payload.
 *
 * Defied count: only rows with a known (non-null) majority contribute. Pre-unlock
 * runs and fighters absent from `crowdStats` return null majority and are skipped.
 * If `unlocked` is false or `crowdStats` is null, `defied` itself is null
 * (we surface "no data" rather than "0 contrarian picks").
 */
export function computeRunResult(input: ComputeRunResultInput): RunResult {
  const { picks, order, crowdStats, unlocked, runId } = input;

  if (picks.length !== 9) {
    throw new RangeError(`computeRunResult: picks must have length 9, got ${picks.length}`);
  }
  if (order.length !== 9) {
    throw new RangeError(`computeRunResult: order must have length 9, got ${order.length}`);
  }

  const oldPicks = picks.filter((p) => p === 'old').length;
  const newPicks = 9 - oldPicks;
  const archetype = archetypeFor(oldPicks);
  const date = input.date ?? formatUtcDate(new Date());

  const haveCrowdData = unlocked && crowdStats !== null;

  const pickRows: PickRow[] = [];
  let defiedCount = 0;
  for (let i = 0; i < 9; i++) {
    const idx = order[i];
    const fighter = FIGHTERS[idx];
    if (!fighter) {
      throw new RangeError(`computeRunResult: order[${i}] = ${idx} is out of range`);
    }
    const choice = picks[i];

    let majority: Era | null = null;
    if (haveCrowdData) {
      const counts = crowdStats[fighter.id];
      if (counts && counts.total > 0) {
        majority = majorityOf(counts);
      }
    }

    if (majority !== null && choice !== majority) {
      defiedCount += 1;
    }

    pickRows.push({ fighter: fighter.id, choice, majority });
  }

  const defied = haveCrowdData ? defiedCount : null;

  return {
    oldPicks,
    newPicks,
    picks: pickRows,
    defied,
    archetype,
    runId,
    date,
  };
}
