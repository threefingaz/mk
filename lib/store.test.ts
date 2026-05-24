// Unit tests for the Zustand stores (Task 9).
//
// jsdom provides localStorage + sessionStorage; we exercise them directly to
// assert that persistence writes actually land.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Era } from './fighters';

// Mock the api-client BEFORE importing the store — store.ts imports
// submitVote at module load. The mock function is exported so individual
// tests can inspect calls + change resolved values.
vi.mock('./api-client', () => ({
  submitVote: vi.fn(async () => ({ ok: true, unlocked: false })),
}));

import { submitVote } from './api-client';
import { FIGHTERS } from './fighters';
import {
  __resetStoresForTest,
  useIdentityStore,
  useRunStore,
  type RunResult,
} from './store';

beforeEach(() => {
  // Clear both browser-shaped storages between tests so persisted state from
  // one test never leaks into the next.
  sessionStorage.clear();
  localStorage.clear();
  __resetStoresForTest();
  vi.mocked(submitVote).mockClear();
  vi.mocked(submitVote).mockResolvedValue({ ok: true, unlocked: false });
});

afterEach(() => {
  sessionStorage.clear();
  localStorage.clear();
});

// ---------------------------------------------------------------------------
// State transitions
// ---------------------------------------------------------------------------

describe('useRunStore — state transitions', () => {
  it('initial state has phase=landing, step=0, no picks, empty runId', () => {
    const s = useRunStore.getState();
    expect(s.phase).toBe('landing');
    expect(s.step).toBe(0);
    expect(s.picks).toEqual([]);
    expect(s.duelState).toBe('idle');
    expect(s.order).toEqual([]);
    expect(s.runId).toBe('');
  });

  it('start() flips to phase=duel with a fresh runId and 9-permutation order', () => {
    useRunStore.getState().start();
    const s = useRunStore.getState();
    expect(s.phase).toBe('duel');
    expect(s.step).toBe(0);
    expect(s.picks).toEqual([]);
    expect(s.duelState).toBe('idle');
    expect(typeof s.runId).toBe('string');
    expect(s.runId.length).toBeGreaterThan(0);
    expect(s.order).toHaveLength(9);
    expect(new Set(s.order)).toEqual(new Set([0, 1, 2, 3, 4, 5, 6, 7, 8]));
  });

  it('pick(old) sets duelState=pickedOld; pick(new) sets duelState=pickedNew', () => {
    useRunStore.getState().start();
    useRunStore.getState().pick('old');
    expect(useRunStore.getState().duelState).toBe('pickedOld');
    useRunStore.getState().pick('new');
    expect(useRunStore.getState().duelState).toBe('pickedNew');
  });

  it('9× (pick → next) walks step 0→9 and transitions to phase=verdict on the 9th next()', () => {
    useRunStore.getState().start();
    for (let i = 0; i < 9; i++) {
      expect(useRunStore.getState().phase).toBe('duel');
      expect(useRunStore.getState().step).toBe(i);
      useRunStore.getState().pick('old');
      useRunStore.getState().next();
    }
    const s = useRunStore.getState();
    expect(s.phase).toBe('verdict');
    expect(s.picks).toHaveLength(9);
    expect(s.picks.every((p) => p === 'old')).toBe(true);
    expect(s.duelState).toBe('idle');
  });

  it('next() with no pending pick is a no-op (defensive guard)', () => {
    useRunStore.getState().start();
    const before = useRunStore.getState();
    useRunStore.getState().next();
    const after = useRunStore.getState();
    expect(after.step).toBe(before.step);
    expect(after.picks).toEqual(before.picks);
    expect(after.phase).toBe(before.phase);
  });

  it('advanceToShare() transitions phase: verdict → share', () => {
    useRunStore.getState().start();
    for (let i = 0; i < 9; i++) {
      useRunStore.getState().pick('new');
      useRunStore.getState().next();
    }
    expect(useRunStore.getState().phase).toBe('verdict');
    useRunStore.getState().advanceToShare();
    expect(useRunStore.getState().phase).toBe('share');
  });

  it('advanceToShare() is a no-op outside phase=verdict', () => {
    useRunStore.getState().start();
    expect(useRunStore.getState().phase).toBe('duel');
    useRunStore.getState().advanceToShare();
    expect(useRunStore.getState().phase).toBe('duel');
  });

  it('loadPriorRunForSharing() hydrates picks/order/runId from priorRun and jumps to share', () => {
    // Returning-visitor case: in-progress slice is empty; we restore from
    // identity.priorRun so the share screen has something to render.
    const priorPicks: Era[] = ['old', 'new', 'old', 'new', 'old', 'new', 'old', 'new', 'old'];
    const priorOrder = [4, 2, 7, 0, 8, 5, 1, 6, 3];
    const priorRunId = 'prior-run-id-abc';

    // Pre-condition: the in-progress slice is empty (just like a returning visit).
    expect(useRunStore.getState().picks).toEqual([]);
    expect(useRunStore.getState().order).toEqual([]);
    expect(useRunStore.getState().runId).toBe('');
    expect(useRunStore.getState().phase).toBe('landing');

    useRunStore.getState().loadPriorRunForSharing({
      picks: priorPicks,
      order: priorOrder,
      runId: priorRunId,
    });

    const s = useRunStore.getState();
    expect(s.picks).toEqual(priorPicks);
    expect(s.order).toEqual(priorOrder);
    expect(s.runId).toBe(priorRunId);
    expect(s.step).toBe(9);
    expect(s.duelState).toBe('idle');
    expect(s.phase).toBe('share');
  });

  it('goBackToVerdict() transitions phase: share → verdict (and is a no-op elsewhere)', () => {
    useRunStore.getState().start();
    for (let i = 0; i < 9; i++) {
      useRunStore.getState().pick('old');
      useRunStore.getState().next();
    }
    useRunStore.getState().advanceToShare();
    expect(useRunStore.getState().phase).toBe('share');
    useRunStore.getState().goBackToVerdict();
    expect(useRunStore.getState().phase).toBe('verdict');
    // No-op outside phase=share.
    useRunStore.getState().goBackToVerdict();
    expect(useRunStore.getState().phase).toBe('verdict');
  });

  it('setUnlocked / setCrowdStats mutate CrowdState (not persisted)', () => {
    useRunStore.getState().setUnlocked(true);
    useRunStore.getState().setCrowdStats({
      raiden: { old: 5, new: 7, total: 12 },
    });
    const s = useRunStore.getState();
    expect(s.scoreboardUnlocked).toBe(true);
    expect(s.crowdStats.raiden).toEqual({ old: 5, new: 7, total: 12 });
  });

  it('setUnlockProgress writes plays and threshold onto CrowdState', () => {
    // Initial values come from RUN_INITIAL (plays=0, threshold=30).
    expect(useRunStore.getState().plays).toBe(0);
    expect(useRunStore.getState().threshold).toBe(30);

    useRunStore.getState().setUnlockProgress({ plays: 18, threshold: 30 });
    let s = useRunStore.getState();
    expect(s.plays).toBe(18);
    expect(s.threshold).toBe(30);

    // Second write replaces both fields independently.
    useRunStore.getState().setUnlockProgress({ plays: 42, threshold: 5 });
    s = useRunStore.getState();
    expect(s.plays).toBe(42);
    expect(s.threshold).toBe(5);
  });
});

// ---------------------------------------------------------------------------
// Shuffle correctness — repeat many times, assert every order is a valid
// 0..8 permutation.
// ---------------------------------------------------------------------------

describe('useRunStore — start() shuffle correctness', () => {
  it('every order produced by start() is a permutation of 0..8 across 100 runs', () => {
    for (let i = 0; i < 100; i++) {
      useRunStore.getState().start();
      const order = useRunStore.getState().order;
      expect(order).toHaveLength(9);
      expect(new Set(order).size).toBe(9);
      for (const idx of order) {
        expect(idx).toBeGreaterThanOrEqual(0);
        expect(idx).toBeLessThanOrEqual(8);
      }
    }
  });

  it('produces at least 2 distinct orderings across 50 runs (sanity: not constant)', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 50; i++) {
      useRunStore.getState().start();
      seen.add(useRunStore.getState().order.join(','));
    }
    // With 9! = 362880 permutations, collisions across 50 runs are virtually
    // impossible. If the shuffler returned a constant order we'd see size=1.
    expect(seen.size).toBeGreaterThan(1);
  });

  it('produces a different runId on each start()', () => {
    useRunStore.getState().start();
    const first = useRunStore.getState().runId;
    useRunStore.getState().start();
    const second = useRunStore.getState().runId;
    expect(first).not.toBe(second);
  });
});

// ---------------------------------------------------------------------------
// Identity store
// ---------------------------------------------------------------------------

describe('useIdentityStore', () => {
  it('starts with muted=true, hasVoted=false, no priorRun, empty votedMatchups', () => {
    const s = useIdentityStore.getState();
    expect(s.muted).toBe(true);
    expect(s.hasVoted).toBe(false);
    expect(s.priorRun).toBeUndefined();
    expect(s.votedMatchups).toEqual({});
    expect(s.seenUnlock).toBe(false);
  });

  it('setMuted toggles muted flag', () => {
    useIdentityStore.getState().setMuted(false);
    expect(useIdentityStore.getState().muted).toBe(false);
    useIdentityStore.getState().setMuted(true);
    expect(useIdentityStore.getState().muted).toBe(true);
  });

  it('markUnlockSeen sets seenUnlock=true', () => {
    useIdentityStore.getState().markUnlockSeen();
    expect(useIdentityStore.getState().seenUnlock).toBe(true);
  });

  it('recordCompletion writes hasVoted=true + priorRun', () => {
    const result: RunResult = {
      picks: ['old', 'new', 'old', 'new', 'old', 'new', 'old', 'new', 'old'],
      order: [0, 1, 2, 3, 4, 5, 6, 7, 8],
      archetypeName: 'OG PURIST',
      runId: 'test-run-1',
      completedAt: 1700000000000,
    };
    useIdentityStore.getState().recordCompletion(result);
    const s = useIdentityStore.getState();
    expect(s.hasVoted).toBe(true);
    expect(s.priorRun).toEqual(result);
  });

  it('recordCompletion is last-write-wins on priorRun', () => {
    const first: RunResult = {
      picks: Array(9).fill('old') as Era[],
      order: [0, 1, 2, 3, 4, 5, 6, 7, 8],
      archetypeName: 'FIRST',
      runId: 'first',
      completedAt: 1,
    };
    const second: RunResult = {
      picks: Array(9).fill('new') as Era[],
      order: [8, 7, 6, 5, 4, 3, 2, 1, 0],
      archetypeName: 'SECOND',
      runId: 'second',
      completedAt: 2,
    };
    useIdentityStore.getState().recordCompletion(first);
    useIdentityStore.getState().recordCompletion(second);
    expect(useIdentityStore.getState().priorRun).toEqual(second);
    expect(useIdentityStore.getState().hasVoted).toBe(true);
  });

  // votedMatchups dedupe lives at the *intent-to-submit* layer (Task 25's
  // `recordPickAndSubmit` checks the flag before firing the network call).
  // This action is intentionally last-write-wins.
  it('markVoted is last-write-wins (dedupe enforced upstream in Task 25)', () => {
    useIdentityStore.getState().markVoted('raiden', 'old');
    expect(useIdentityStore.getState().votedMatchups.raiden).toBe('old');
    useIdentityStore.getState().markVoted('raiden', 'new');
    expect(useIdentityStore.getState().votedMatchups.raiden).toBe('new');
  });

  it('markVoted preserves entries for other matchups', () => {
    useIdentityStore.getState().markVoted('raiden', 'old');
    useIdentityStore.getState().markVoted('scorpion', 'new');
    useIdentityStore.getState().markVoted('liukang', 'old');
    const map = useIdentityStore.getState().votedMatchups;
    expect(map.raiden).toBe('old');
    expect(map.scorpion).toBe('new');
    expect(map.liukang).toBe('old');
  });
});

// ---------------------------------------------------------------------------
// recordPickAndSubmit — side-effecting pick wrapper (Task 25)
// ---------------------------------------------------------------------------

describe('useRunStore.recordPickAndSubmit', () => {
  it('first time for a matchup → markVoted runs synchronously (intent captured before submitVote)', async () => {
    useRunStore.getState().start();
    const { order, step, runId } = useRunStore.getState();
    const fighter = FIGHTERS[order[step]];

    useRunStore.getState().recordPickAndSubmit('old');

    // markVoted now fires synchronously (before submitVote) so the dedupe
    // flag is set even if the user navigates away before the network resolves.
    expect(useIdentityStore.getState().votedMatchups[fighter.id]).toBe('old');

    // submitVote was invoked synchronously with the correct args.
    expect(submitVote).toHaveBeenCalledTimes(1);
    expect(submitVote).toHaveBeenCalledWith(fighter.id, 'old', runId);

    // pick(era) ran synchronously too — duelState reflects the choice.
    expect(useRunStore.getState().duelState).toBe('pickedOld');

    // Drain microtasks so the resolved promise doesn't trigger anything
    // unexpected after the test ends.
    await Promise.resolve();
  });

  it('second time for the same matchup → does NOT call submitVote (dedupe via votedMatchups)', async () => {
    useRunStore.getState().start();
    const { order, step } = useRunStore.getState();
    const fighter = FIGHTERS[order[step]];

    // Pre-populate the dedupe flag (simulating "submitted from a previous
    // session on this browser").
    useIdentityStore.getState().markVoted(fighter.id, 'new');
    expect(useIdentityStore.getState().votedMatchups[fighter.id]).toBe('new');

    vi.mocked(submitVote).mockClear();
    useRunStore.getState().recordPickAndSubmit('old');

    expect(submitVote).not.toHaveBeenCalled();
    // pick(era) still ran — duelState transitions regardless of network outcome.
    expect(useRunStore.getState().duelState).toBe('pickedOld');
    // The persisted vote stays at 'new' (last write wins; recordPickAndSubmit
    // intentionally does not overwrite the flag when skipping).
    await Promise.resolve();
    expect(useIdentityStore.getState().votedMatchups[fighter.id]).toBe('new');
  });

  it('calls pick(era) even when submitVote rejects (defensive)', async () => {
    // The resilience client never rejects, but defend against future changes
    // by exercising a real rejection here. recordPickAndSubmit wraps the
    // submitVote promise in .catch() — pick() must still run synchronously
    // and the local markVoted must still fire before submitVote is invoked.
    vi.mocked(submitVote).mockRejectedValueOnce(new Error('boom'));

    useRunStore.getState().start();
    useRunStore.getState().recordPickAndSubmit('new');

    expect(useRunStore.getState().duelState).toBe('pickedNew');
    // submitVote was still called.
    expect(submitVote).toHaveBeenCalledTimes(1);
    // markVoted is called BEFORE submitVote now (local intent captured first).
    const { order, step } = useRunStore.getState();
    const fighter = FIGHTERS[order[step]];
    expect(useIdentityStore.getState().votedMatchups[fighter.id]).toBe('new');
    // Drain microtasks to flush the rejected promise + .catch() handler so
    // the test doesn't leak an unhandled rejection.
    await Promise.resolve();
    await Promise.resolve();
  });

  it('calls pick(era) even when network call is skipped (already-voted path)', () => {
    useRunStore.getState().start();
    const { order, step } = useRunStore.getState();
    const fighter = FIGHTERS[order[step]];
    useIdentityStore.getState().markVoted(fighter.id, 'old');

    vi.mocked(submitVote).mockClear();
    useRunStore.getState().recordPickAndSubmit('new');

    expect(submitVote).not.toHaveBeenCalled();
    // pick still ran.
    expect(useRunStore.getState().duelState).toBe('pickedNew');
  });

  it('cross-era retap (old → new) swaps duelState; server vote stays bound to first pick', () => {
    // The "re-pick before NEXT" affordance. The user taps OLD, then taps NEW
    // before next(): duelState swaps, but no second markVoted / submitVote.
    useRunStore.getState().start();
    const { order, step, runId } = useRunStore.getState();
    const fighter = FIGHTERS[order[step]];

    useRunStore.getState().recordPickAndSubmit('old');
    expect(useRunStore.getState().duelState).toBe('pickedOld');
    expect(submitVote).toHaveBeenCalledTimes(1);
    expect(submitVote).toHaveBeenCalledWith(fighter.id, 'old', runId);
    expect(useIdentityStore.getState().votedMatchups[fighter.id]).toBe('old');

    useRunStore.getState().recordPickAndSubmit('new');

    expect(useRunStore.getState().duelState).toBe('pickedNew');
    expect(submitVote).toHaveBeenCalledTimes(1); // still 1 — no resubmit on swap
    expect(useIdentityStore.getState().votedMatchups[fighter.id]).toBe('old'); // unchanged
  });

  it('cross-era retap (new → old) — symmetric swap path', () => {
    useRunStore.getState().start();
    const { order, step, runId } = useRunStore.getState();
    const fighter = FIGHTERS[order[step]];

    useRunStore.getState().recordPickAndSubmit('new');
    expect(useRunStore.getState().duelState).toBe('pickedNew');
    expect(submitVote).toHaveBeenCalledTimes(1);
    expect(submitVote).toHaveBeenCalledWith(fighter.id, 'new', runId);
    expect(useIdentityStore.getState().votedMatchups[fighter.id]).toBe('new');

    useRunStore.getState().recordPickAndSubmit('old');

    expect(useRunStore.getState().duelState).toBe('pickedOld');
    expect(submitVote).toHaveBeenCalledTimes(1);
    expect(useIdentityStore.getState().votedMatchups[fighter.id]).toBe('new');
  });

  it('same-era retap is a true no-op (does not re-invoke pick / submitVote / markVoted)', () => {
    // Defensive backstop for the JSX same-era guard in Duel.tsx.
    useRunStore.getState().start();
    const { order, step } = useRunStore.getState();
    const fighter = FIGHTERS[order[step]];

    useRunStore.getState().recordPickAndSubmit('old');
    expect(useRunStore.getState().duelState).toBe('pickedOld');
    expect(submitVote).toHaveBeenCalledTimes(1);
    expect(useIdentityStore.getState().votedMatchups[fighter.id]).toBe('old');

    // Spy on pick to assert the no-op short-circuits *at the top* of the
    // function (before reaching the final useRunStore.getState().pick(era)).
    const pickSpy = vi.spyOn(useRunStore.getState(), 'pick');
    useRunStore.getState().recordPickAndSubmit('old');

    expect(useRunStore.getState().duelState).toBe('pickedOld');
    expect(submitVote).toHaveBeenCalledTimes(1);
    expect(useIdentityStore.getState().votedMatchups[fighter.id]).toBe('old');
    expect(pickSpy).not.toHaveBeenCalled();

    pickSpy.mockRestore();
  });

  it('after next(), the next step\'s first pick is treated as a first-pick (not a swap)', () => {
    // Cross-step regression guard: next() must reset duelState to 'idle' so
    // the next step's first call to recordPickAndSubmit records a fresh vote.
    useRunStore.getState().start();
    const stepZero = useRunStore.getState();
    const fighterZero = FIGHTERS[stepZero.order[stepZero.step]];

    useRunStore.getState().recordPickAndSubmit('new');
    expect(submitVote).toHaveBeenCalledTimes(1);
    expect(submitVote).toHaveBeenLastCalledWith(fighterZero.id, 'new', stepZero.runId);

    useRunStore.getState().next();
    expect(useRunStore.getState().duelState).toBe('idle');
    expect(useRunStore.getState().step).toBe(1);

    const stepOne = useRunStore.getState();
    const fighterOne = FIGHTERS[stepOne.order[stepOne.step]];

    useRunStore.getState().recordPickAndSubmit('old');

    expect(useRunStore.getState().duelState).toBe('pickedOld');
    expect(submitVote).toHaveBeenCalledTimes(2);
    expect(submitVote).toHaveBeenLastCalledWith(fighterOne.id, 'old', stepOne.runId);
    expect(useIdentityStore.getState().votedMatchups[fighterZero.id]).toBe('new');
    expect(useIdentityStore.getState().votedMatchups[fighterOne.id]).toBe('old');
  });
});

// ---------------------------------------------------------------------------
// Persistence — exercise jsdom's sessionStorage and localStorage.
// ---------------------------------------------------------------------------

describe('persistence', () => {
  it('useIdentityStore writes to localStorage under key "mk-identity"', async () => {
    useIdentityStore.getState().setMuted(false);
    // persist middleware writes synchronously after set() in jsdom; allow a
    // microtask flush just in case.
    await Promise.resolve();
    const raw = localStorage.getItem('mk-identity');
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw!);
    // zustand persist wraps state under { state, version }.
    expect(parsed.state.muted).toBe(false);
  });

  it('useIdentityStore persists priorRun across recordCompletion', async () => {
    const result: RunResult = {
      picks: Array(9).fill('old') as Era[],
      order: [8, 7, 6, 5, 4, 3, 2, 1, 0],
      archetypeName: 'PURIST',
      runId: 'r-1',
      completedAt: 1,
    };
    useIdentityStore.getState().recordCompletion(result);
    await Promise.resolve();
    const parsed = JSON.parse(localStorage.getItem('mk-identity')!);
    expect(parsed.state.hasVoted).toBe(true);
    expect(parsed.state.priorRun.archetypeName).toBe('PURIST');
    expect(parsed.state.priorRun.runId).toBe('r-1');
  });

  it('useIdentityStore persists votedMatchups', async () => {
    useIdentityStore.getState().markVoted('raiden', 'old');
    useIdentityStore.getState().markVoted('scorpion', 'new');
    await Promise.resolve();
    const parsed = JSON.parse(localStorage.getItem('mk-identity')!);
    expect(parsed.state.votedMatchups.raiden).toBe('old');
    expect(parsed.state.votedMatchups.scorpion).toBe('new');
  });

  it('useRunStore writes to sessionStorage under key "mk-run" after start()', async () => {
    useRunStore.getState().start();
    await Promise.resolve();
    const raw = sessionStorage.getItem('mk-run');
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw!);
    expect(parsed.state.phase).toBe('duel');
    expect(parsed.state.step).toBe(0);
    expect(parsed.state.order).toHaveLength(9);
    expect(typeof parsed.state.runId).toBe('string');
    expect(parsed.state.runId.length).toBeGreaterThan(0);
  });

  it('useRunStore persists ONLY the RunState slice — crowdStats/scoreboardUnlocked are not persisted', async () => {
    useRunStore.getState().start();
    useRunStore.getState().setUnlocked(true);
    useRunStore.getState().setCrowdStats({
      raiden: { old: 1, new: 2, total: 3 },
    });
    await Promise.resolve();
    const parsed = JSON.parse(sessionStorage.getItem('mk-run')!);
    expect(parsed.state).not.toHaveProperty('crowdStats');
    expect(parsed.state).not.toHaveProperty('scoreboardUnlocked');
    // The RunState fields ARE persisted.
    expect(parsed.state).toHaveProperty('phase');
    expect(parsed.state).toHaveProperty('order');
    expect(parsed.state).toHaveProperty('runId');
  });

  it('useRunStore does NOT write to localStorage', async () => {
    useRunStore.getState().start();
    await Promise.resolve();
    expect(localStorage.getItem('mk-run')).toBeNull();
  });

  it('useIdentityStore does NOT write to sessionStorage', async () => {
    useIdentityStore.getState().setMuted(false);
    await Promise.resolve();
    expect(sessionStorage.getItem('mk-identity')).toBeNull();
  });
});
