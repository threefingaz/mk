'use client';

// VerdictRevealScreen — the big reveal moment after the 9th duel (Task 13).
// Ported from design_handoff_old_blood_new_blood/design-reference/src/screens.jsx
// (function VerdictRevealScreen, ~lines 409-440).
//
// Production deltas vs prototype:
//   - Dominant-era background skin (era-old / era-new) on the screen wrapper,
//     keyed off oldPicks >= 5. The prototype used a generic dark gradient.
//   - Card data sourced from useRunStore via computeRunResult() in a useMemo.
//   - CTAs (per plan Q2): NO "RUN AGAIN". Two buttons:
//       SHARE              → store.advanceToShare() (phase: 'verdict' → 'share')
//       SEE SCOREBOARD     → <Link href="/scoreboard">
//
// Side effects (recordCompletion, submitComplete) are NOT wired here — that's
// Task 25's responsibility. This screen is read-only over store state.

import { useEffect, useMemo, useRef } from 'react';
import Link from 'next/link';
import { VerdictCard } from '@/components/VerdictCard';
import { useIdentityStore, useRunStore } from '@/lib/store';
import { computeRunResult, dominantEraClass } from '@/lib/run-result';
import { trackEvent } from '@/lib/analytics';
import { playVerdictSting } from '@/lib/audio';
import { submitComplete } from '@/lib/api-client';

export function Verdict() {
  const picks = useRunStore((s) => s.picks);
  const order = useRunStore((s) => s.order);
  const runId = useRunStore((s) => s.runId);
  const crowdStats = useRunStore((s) => s.crowdStats);
  const scoreboardUnlocked = useRunStore((s) => s.scoreboardUnlocked);
  const advanceToShare = useRunStore((s) => s.advanceToShare);

  // Compute once per pick/order/crowd change. Pure derivation — no side effects.
  const result = useMemo(
    () =>
      computeRunResult({
        picks,
        order,
        crowdStats,
        runId,
        unlocked: scoreboardUnlocked,
      }),
    [picks, order, crowdStats, runId, scoreboardUnlocked],
  );

  // Fire run_complete exactly once on Verdict mount (Task 17b). Captures the
  // mount-time archetype + oldPicks via closure; empty deps so it never refires
  // even if crowdStats arrives later and re-derives `result`.
  const archetypeName = result.archetype.name;
  const oldPicks = result.oldPicks;
  useEffect(() => {
    trackEvent({ name: 'run_complete', props: { archetype: archetypeName, old_picks: oldPicks } });
    // Verdict sting — fire-and-forget. Silent if asset not present.
    playVerdictSting();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Run completion submission (Task 25) ──────────────────────────────────
  // On Verdict mount, persist the local completion record SYNCHRONOUSLY first,
  // then fire POST /api/complete via the resilience client as a side effect.
  //
  // Ordering rationale (per Q2): the local persistence IS the authoritative
  // "this browser completed a run" signal. If the user closes the tab during
  // the resilience client's ~7.5s retry window, the priorRun + hasVoted must
  // already be on disk so the next visit shows ReturningVisitor (not Landing
  // with a replayable run).
  //
  // Two guards keep this fire-once across realistic visit patterns:
  //   1. useRef — React strict-mode double-mount in dev fires effects twice.
  //   2. hasVoted check — returning to the verdict screen via Share BACK
  //      shouldn't re-submit. recordCompletion(...) flips hasVoted=true.
  const completionFiredRef = useRef(false);
  useEffect(() => {
    if (completionFiredRef.current) return;
    // Back-nav guard: if recordCompletion has already run (hasVoted=true),
    // skip the duplicate submitComplete entirely. Server-side seen:<runId>
    // dedupe makes it harmless, but skipping is cheaper.
    if (useIdentityStore.getState().hasVoted) {
      completionFiredRef.current = true;
      return;
    }
    completionFiredRef.current = true;

    // Snapshot fields the persisted priorRun needs. We use the mount-time
    // store values (picks/order/runId) and mount-time archetype so the
    // persisted record is internally consistent.
    const priorRun = {
      picks: [...picks],
      order: [...order],
      archetypeName: result.archetype.name,
      runId: result.runId,
      completedAt: Date.now(),
    };

    // 1. Persist locally FIRST — authoritative per-browser completion record.
    useIdentityStore.getState().recordCompletion(priorRun);

    // 2. Fire the server-side submission fire-and-forget. The resilience
    //    client never rejects, but we don't await — local state is already
    //    committed and the global play count is updated as the network
    //    resolves (or falls back to local-only after 3× retries).
    void submitComplete(result.runId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Dominant-era screen background — matches the era theming on the card top
  // band so the reveal feels coherent.
  const dominant = dominantEraClass(result.oldPicks);

  return (
    <div
      data-testid="verdict-screen"
      className={dominant}
      style={{
        position: 'relative',
        width: '100%',
        minHeight: '100vh',
        background: '#000',
      }}
    >
      {/* Spotlight glow over the dominant skin — keeps the prototype's
          "verdict moment" feel even though the base is now era-treated. */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'radial-gradient(ellipse at 50% 30%, oklch(0.40 0.20 27 / 0.35), transparent 60%)',
          pointerEvents: 'none',
        }}
      />

      <div
        style={{
          position: 'relative',
          zIndex: 4,
          padding: '24px 20px 20px',
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
          minHeight: '100vh',
          boxSizing: 'border-box',
        }}
      >
        {/* Header — VERDICT lockup. */}
        <div style={{ textAlign: 'center' }}>
          <div
            className="nb-mono"
            style={{ fontSize: 9, letterSpacing: '0.4em', color: 'var(--nb-red)' }}
          >
            ·  VERDICT  ·
          </div>
          <div
            className="nb-display nb-condensed"
            style={{
              fontSize: 14,
              color: 'var(--nb-mute)',
              marginTop: 4,
              letterSpacing: '0.18em',
            }}
          >
            9 OF 9 SETTLED
          </div>
        </div>

        {/* Card stage — reveal-up entry animation per plan ("600ms ease-out").
            Aspect-ratio box is enforced here so the inner VerdictCard composes
            cleanly regardless of viewport. containerType:inline-size enables
            the card's cqw-based fluid type. */}
        <div
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div
            data-testid="verdict-card-stage"
            style={{
              width: 'min(82%, 360px)',
              boxShadow:
                '0 30px 80px -10px oklch(0.45 0.22 27 / 0.5), 0 0 0 1px rgba(255,255,255,0.08)',
              animation: 'reveal-up 600ms ease-out',
              containerType: 'inline-size',
            }}
          >
            <VerdictCard result={result} />
          </div>
        </div>

        {/* CTAs — per Q2, NO RUN AGAIN. SHARE + SEE SCOREBOARD only. */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <button
            type="button"
            className="btn-new btn-new-red"
            onClick={() => advanceToShare()}
            data-testid="verdict-share"
            style={{
              fontSize: 14,
              padding: '14px',
              justifyContent: 'center',
              textAlign: 'center',
            }}
          >
            SHARE ↗
          </button>
          <Link
            href="/scoreboard"
            className="btn-new"
            data-testid="verdict-scoreboard"
            style={{
              fontSize: 14,
              padding: '14px',
              justifyContent: 'center',
              textAlign: 'center',
              textDecoration: 'none',
              display: 'inline-flex',
              alignItems: 'center',
            }}
          >
            SEE SCOREBOARD
          </Link>
        </div>
      </div>
    </div>
  );
}
