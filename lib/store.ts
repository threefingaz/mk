// Zustand stores with split persistence (Task 9).
//
// Two named stores, two storage targets:
//
//   useRunStore       — in-progress run state (sessionStorage, dies on tab close)
//                       + CrowdState (NOT persisted; fetched at mount)
//   useIdentityStore  — settled identity (localStorage, survives across sessions)
//
// Per the plan's Task 9 note: `next()` is a PURE state transition with no side
// effects. Task 25 composes a side-effecting wrapper (`recordPickAndSubmit`)
// on top.

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { submitVote } from './api-client';
import { FIGHTERS, type Era, type FighterId } from './fighters';

// ---------------------------------------------------------------------------
// State shapes — lifted verbatim from the plan's `## Technical Details`.
// ---------------------------------------------------------------------------

export type Phase = 'landing' | 'duel' | 'verdict' | 'share';

export type DuelState = 'idle' | 'pickedOld' | 'pickedNew';

// sessionStorage slice — in-progress run, dies on tab close
export type RunState = {
  phase: Phase;
  step: number; // 0..8
  picks: Era[]; // length === step (or 9 once complete)
  duelState: DuelState;
  order: number[]; // shuffled fighter indices for this run
  runId: string; // uuid; idempotency key for /api/complete
};

// Placeholder for RunResult — full shape lands in Task 10 (lib/run-result.ts).
// Defined minimally here so identity persistence has something to type against.
export type RunResult = {
  picks: Era[];
  order: number[];
  archetypeName: string;
  runId: string;
  completedAt: number;
};

// localStorage slice — settled identity, survives across sessions
export type IdentityState = {
  muted: boolean;
  hasVoted: boolean;
  priorRun?: RunResult;
  votedMatchups: Partial<Record<FighterId, Era>>; // per-matchup dedupe
  seenUnlock: boolean; // one-time unlock-moment gate
};

// Fetched, not persisted
export type CrowdState = {
  scoreboardUnlocked: boolean;
  crowdStats: Partial<Record<FighterId, { old: number; new: number; total: number }>>;
  /**
   * Total completed plays as reported by the server (or mocked in Phase 1).
   * Drives the landing-screen countdown chip and the UnlockMoment stat row.
   */
  plays: number;
  /**
   * Unlock threshold (REVEAL_AT). Mirrors server config so screens can render
   * the "plays until unlock" delta without threading env vars through props.
   */
  threshold: number;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Generate a v4 UUID via `crypto.randomUUID()`. Available in all supported
 * runtimes (Node 19+, all modern browsers). Not security-sensitive — used as
 * an idempotency key for /api/complete.
 */
function makeRunId(): string {
  return globalThis.crypto.randomUUID();
}

/**
 * Fisher-Yates shuffle of [0..n-1]. Math.random is fine here — this is run
 * order randomization, not security-sensitive.
 */
function shuffledIndices(n: number): number[] {
  const arr = Array.from({ length: n }, (_, i) => i);
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// SSR check inline at the persist `storage` option so the persist middleware
// skips hydration on the server. `createJSONStorage` is called only on the
// client where the storage accessor is safe to evaluate.

// ---------------------------------------------------------------------------
// useRunStore — RunState + CrowdState. RunState persisted to sessionStorage.
// ---------------------------------------------------------------------------

export type RunStore = RunState &
  CrowdState & {
    start: () => void;
    pick: (era: Era) => void;
    /**
     * Side-effecting pick wrapper (Task 25). Combines the pure `pick(era)`
     * state mutation with fire-and-forget vote submission. Keeps `next()`
     * pure (per Task 9 contract) by routing the network call through this
     * separate action invoked from DuelScreen's pick handler.
     *
     * Behavior:
     *  - Reads `votedMatchups[fighter.id]` from useIdentityStore. If already
     *    set, the matchup was submitted from an earlier session on this
     *    browser — skip the network call (server-side rate-limit + per-IP
     *    dedupe makes a re-submit safe, but skipping is cheaper and aligns
     *    with the plan's Q3 contract).
     *  - Else fires `submitVote()`; on resolve calls `markVoted()` to set
     *    the dedupe flag so subsequent picks for the same matchup are
     *    skipped. The submit is NOT awaited — the UI advances immediately.
     *  - Always calls `pick(era)` so the duel transitions regardless of
     *    network outcome (resilience layer makes failures invisible to UI).
     */
    recordPickAndSubmit: (era: Era) => void;
    next: () => void;
    advanceToShare: () => void;
    goBackToVerdict: () => void;
    setUnlocked: (b: boolean) => void;
    setCrowdStats: (stats: CrowdState['crowdStats']) => void;
    setUnlockProgress: (progress: { plays: number; threshold: number }) => void;
    loadPriorRunForSharing: (prior: Pick<RunResult, 'picks' | 'order' | 'runId'>) => void;
  };

const RUN_INITIAL: RunState & CrowdState = {
  phase: 'landing',
  step: 0,
  picks: [],
  duelState: 'idle',
  order: [],
  runId: '',
  scoreboardUnlocked: false,
  crowdStats: {},
  plays: 0,
  threshold: 30,
};

type PersistedRunSlice = Pick<RunState, 'phase' | 'step' | 'picks' | 'duelState' | 'order' | 'runId'>;

export const useRunStore = create<RunStore>()(
  persist(
    (set) => ({
      ...RUN_INITIAL,

      start: () =>
        set({
          phase: 'duel',
          step: 0,
          picks: [],
          duelState: 'idle',
          order: shuffledIndices(9),
          runId: makeRunId(),
        }),

      pick: (era) =>
        set({
          duelState: era === 'old' ? 'pickedOld' : 'pickedNew',
        }),

      // Side-effecting pick wrapper. Contract:
      //   - First pick of a step → markVoted + submitVote (subject to
      //     per-matchup dedupe) + set duelState.
      //   - Cross-era retap before next() → swap duelState only. Server vote
      //     stays bound to the first pick; no second markVoted, no second
      //     submitVote. This is the "re-pick before NEXT" affordance.
      //   - Same-era retap → no-op (defensive backstop for the JSX same-era
      //     guard in Duel.tsx; covers any future caller that forgets to gate).
      //
      // Trade-off: server vote is locked to the first pick on each matchup
      // (per-matchup dedupe per CLAUDE.md's "one-vote-per-matchup-per-browser"
      // contract). Local picks (and therefore archetype + share code) reflect
      // the swap. Don't try to re-submit on swap — server dedupe would drop
      // it, and a future dedupe relaxation would cause double-count drift.
      recordPickAndSubmit: (era) => {
        // Re-read state fresh inside the function so a bounce-tap race
        // (two taps queued in one React event flush) correctly sees the
        // updated duelState after the first tap's synchronous pick() set.
        const fresh = useRunStore.getState();
        const currentEra: Era | null =
          fresh.duelState === 'pickedOld'
            ? 'old'
            : fresh.duelState === 'pickedNew'
              ? 'new'
              : null;

        if (currentEra === era) return;

        const { order, step, runId } = fresh;
        const fighterIndex = order[step];
        if (fighterIndex === undefined) {
          // Defensive: start() always populates `order` before phase flips to
          // 'duel', so this is only reachable in unit tests or if a caller
          // skips start(). Flip duelState anyway so the screen doesn't
          // deadlock on a stuck 'idle' state; skip the network call (no
          // fighter to reference in the vote payload).
          useRunStore.getState().pick(era);
          return;
        }
        const fighter = FIGHTERS[fighterIndex];

        if (currentEra === null) {
          const identity = useIdentityStore.getState();
          const alreadyVoted = identity.votedMatchups[fighter.id] !== undefined;
          if (!alreadyVoted) {
            useIdentityStore.getState().markVoted(fighter.id, era);
            void submitVote(fighter.id, era, runId);
          }
        }

        useRunStore.getState().pick(era);
      },

      // Pure state transition — no side effects. Task 25 wraps this with
      // network submission via `recordPickAndSubmit`.
      next: () =>
        set((s) => {
          // Determine the era picked this turn from duelState.
          const era: Era | null =
            s.duelState === 'pickedOld' ? 'old' : s.duelState === 'pickedNew' ? 'new' : null;
          if (era === null) {
            // next() without a pick is a no-op; defensive guard.
            return s;
          }
          const nextPicks: Era[] = [...s.picks, era];
          const nextStep = s.step + 1;
          if (nextStep >= 9) {
            return {
              ...s,
              picks: nextPicks,
              step: nextStep,
              duelState: 'idle',
              phase: 'verdict',
            };
          }
          return {
            ...s,
            picks: nextPicks,
            step: nextStep,
            duelState: 'idle',
          };
        }),

      advanceToShare: () =>
        set((s) => (s.phase === 'verdict' ? { ...s, phase: 'share' } : s)),

      goBackToVerdict: () =>
        set((s) => (s.phase === 'share' ? { ...s, phase: 'verdict' } : s)),

      setUnlocked: (b) => set({ scoreboardUnlocked: b }),
      setCrowdStats: (stats) => set({ crowdStats: stats }),
      setUnlockProgress: ({ plays, threshold }) => set({ plays, threshold }),

      // Used by the ReturningVisitor screen (Task 16) when the user clicks
      // SHARE YOUR VERDICT. The in-progress slice is empty for a returning
      // visitor — the share screen reads picks/order/runId from this store,
      // so we hydrate them from the persisted priorRun before transitioning
      // phase to 'share'. step is set to 9 (run complete) and duelState
      // reset to 'idle' so the share screen sees a coherent "post-run" state.
      loadPriorRunForSharing: (prior) =>
        set({
          picks: prior.picks,
          order: prior.order,
          runId: prior.runId,
          step: 9,
          duelState: 'idle',
          phase: 'share',
        }),
    }),
    {
      name: 'mk-run',
      storage:
        typeof window === 'undefined'
          ? undefined
          : createJSONStorage<PersistedRunSlice>(() => sessionStorage),
      partialize: (s): PersistedRunSlice => ({
        phase: s.phase,
        step: s.step,
        picks: s.picks,
        duelState: s.duelState,
        order: s.order,
        runId: s.runId,
      }),
    },
  ),
);

// ---------------------------------------------------------------------------
// useIdentityStore — IdentityState. Persisted to localStorage.
// ---------------------------------------------------------------------------

export type IdentityStore = IdentityState & {
  setMuted: (b: boolean) => void;
  recordCompletion: (result: RunResult) => void;
  markVoted: (matchupId: FighterId, choice: Era) => void;
  markUnlockSeen: () => void;
};

const IDENTITY_INITIAL: IdentityState = {
  muted: true, // per Q6 + Task 18: default muted; unlocks on first gesture.
  hasVoted: false,
  priorRun: undefined,
  votedMatchups: {},
  seenUnlock: false,
};

export const useIdentityStore = create<IdentityStore>()(
  persist(
    (set) => ({
      ...IDENTITY_INITIAL,

      setMuted: (b) => set({ muted: b }),

      recordCompletion: (result) =>
        set({
          hasVoted: true,
          priorRun: result,
        }),

      // Last-write-wins on the matchup → era map. Intentional: the dedupe
      // contract lives at the intent-to-submit layer (Task 25's
      // `recordPickAndSubmit` skips the network call when the flag is
      // already set), NOT in this action. Re-recording the same matchup
      // here is benign for the persisted state.
      markVoted: (matchupId, choice) =>
        set((s) => ({
          votedMatchups: { ...s.votedMatchups, [matchupId]: choice },
        })),

      markUnlockSeen: () => set({ seenUnlock: true }),
    }),
    {
      name: 'mk-identity',
      storage:
        typeof window === 'undefined'
          ? undefined
          : createJSONStorage<IdentityStore>(() => localStorage),
    },
  ),
);

// ---------------------------------------------------------------------------
// Test helpers (exported for unit-test reset between cases).
// ---------------------------------------------------------------------------

/** Reset both stores to their initial state. Used in test `beforeEach`.
 *
 * Important: we do NOT pass `true` (replace=true) to setState — that would
 * wipe the action methods too. Instead we merge the initial *data* fields
 * back over the current state, preserving the action closures defined in
 * the store's creator. */
export function __resetStoresForTest(): void {
  useRunStore.setState({ ...RUN_INITIAL });
  useIdentityStore.setState({ ...IDENTITY_INITIAL });
}
