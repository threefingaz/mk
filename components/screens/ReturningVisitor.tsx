'use client';

// ReturningVisitorScreen — shown when the player has already completed a run
// on this browser (`hasVoted === true`) AND is NOT in the one-shot unlock
// moment window (Task 16).
//
// Ported from design_handoff_old_blood_new_blood/design-reference/src/screens.jsx
// (function ReturningVisitorScreen, ~lines 508-559), restructured to render
// the LIVE verdict card: picks are frozen but `defied` is re-derived against
// current crowdStats every render — so the contrarian count drifts as the
// crowd evolves.
//
// Expected usage (wired in Task 17):
//   <ReturningVisitor plays={results.plays} threshold={results.threshold} />
//   Mount-time routing precedence (Task 17):
//     hasVoted && !UnlockMoment-eligible  →  ReturningVisitor
//
// Production deltas vs prototype:
//   - Reuses <VerdictCard result={liveResult} /> instead of the prototype's
//     bespoke n1/unlocked branching — the card already handles both via the
//     RunResult shape.
//   - NO replay CTA per Q2 (one run per browser). The prototype's "NEW RUN ↻"
//     button is dropped.
//   - Share actions (COPY LINK + SAVE IMAGE) render inline via <ShareActions>
//     reading priorRun directly. The standalone Share screen was merged into
//     Verdict — there's no separate sharing destination anymore.
//   - Dominant-era background follows the user's original lean (oldPicks >= 5).

import { useMemo } from 'react';
import Link from 'next/link';
import { BrandMark } from '@/components/BrandMark';
import { VerdictCard } from '@/components/VerdictCard';
import { ShareActions } from '@/components/ShareActions';
import { useIdentityStore, useRunStore } from '@/lib/store';
import { computeRunResult, dominantEraClass } from '@/lib/run-result';

export type ReturningVisitorProps = {
  /** Total completed plays from the server. */
  plays?: number;
  /** Unlock threshold (REVEAL_AT). */
  threshold?: number;
};

export function ReturningVisitor({ plays = 0, threshold = 30 }: ReturningVisitorProps) {
  const priorRun = useIdentityStore((s) => s.priorRun);
  const crowdStats = useRunStore((s) => s.crowdStats);
  const scoreboardUnlocked = useRunStore((s) => s.scoreboardUnlocked);

  // Defensive guard: if somehow this renders without a priorRun (it
  // shouldn't, but persistence edge cases happen — e.g. corrupted localStorage),
  // bail to a minimal message. Task 17's routing precedence should prevent
  // this in practice.
  const liveResult = useMemo(() => {
    if (!priorRun) return null;
    return computeRunResult({
      picks: priorRun.picks,
      order: priorRun.order,
      crowdStats,
      runId: priorRun.runId,
      unlocked: scoreboardUnlocked,
    });
  }, [priorRun, crowdStats, scoreboardUnlocked]);

  if (!priorRun || !liveResult) {
    return (
      <div
        data-testid="returning-visitor-empty"
        style={{
          minHeight: '100vh',
          background: '#000',
          color: 'var(--nb-mute)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
        }}
      >
        <div
          className="nb-mono"
          style={{ fontSize: 12, letterSpacing: '0.2em', textAlign: 'center' }}
        >
          NO PRIOR RUN FOUND
        </div>
      </div>
    );
  }

  const dominant = dominantEraClass(liveResult.oldPicks);
  const sinceUnlock = scoreboardUnlocked ? Math.max(0, plays - threshold) : 0;

  return (
    <div
      data-testid="returning-visitor-screen"
      className={dominant}
      style={{
        position: 'relative',
        width: '100%',
        minHeight: '100vh',
        background: '#000',
      }}
    >
      {/* Quiet darkening over the era skin so the card reads as the hero. */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'linear-gradient(180deg, rgba(0,0,0,0.45) 0%, rgba(0,0,0,0.7) 100%)',
          pointerEvents: 'none',
        }}
      />

      <div
        className="content-column"
        style={{
          position: 'relative',
          zIndex: 4,
          // Padding/gap come from the `.content-column` rule's CSS custom
          // properties so the four long-form screens stay in sync.
          padding: 'var(--col-pad-y-top) var(--col-pad-x) var(--col-pad-y-bot)',
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--col-gap)',
        }}
      >
        {/* Header — brand + welcome eyebrow. */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <BrandMark size="clamp(11px, 1.6vw, 18px)" />
        </div>

        {/* Welcome lockup. */}
        <div>
          <div
            className="nb-mono"
            style={{
              fontSize: 'clamp(10px, 1.2vw, 13px)',
              letterSpacing: '0.3em',
              color: 'var(--nb-mute)',
            }}
          >
            WELCOME BACK
          </div>
          <div
            className="nb-display nb-condensed"
            style={{
              fontSize: 'clamp(28px, 4vw, 52px)',
              lineHeight: 1,
              color: 'var(--nb-bone)',
              marginTop: 4,
            }}
          >
            YOUR VERDICT&apos;S STILL HERE
          </div>
        </div>

        {/* Verdict card preview — live `defied` count derived against current
            crowd stats. containerType:inline-size lets the card's cqw-based
            fluid type compose cleanly. */}
        <div
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div
            data-testid="returning-card-stage"
            style={{
              width: 'var(--card-stage-w-sm)',
              boxShadow:
                '0 24px 60px -10px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.08)',
              containerType: 'inline-size',
            }}
          >
            <VerdictCard result={liveResult} />
          </div>
        </div>

        {/* Since-you-voted stats row. Always shows total plays; appends
            "SINCE UNLOCK" delta only when the board is live. */}
        <div
          data-testid="returning-stats"
          style={{
            border: '1px solid var(--nb-line)',
            background: 'rgba(0,0,0,0.4)',
            padding: 'clamp(10px, 1.4vw, 16px) clamp(14px, 1.8vw, 22px)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'baseline',
            gap: 10,
          }}
        >
          <div
            className="nb-mono"
            style={{
              fontSize: 'clamp(10px, 1.2vw, 13px)',
              letterSpacing: '0.2em',
              color: 'var(--nb-mute)',
            }}
          >
            SINCE YOU VOTED
          </div>
          <div
            className="nb-display nb-condensed"
            style={{
              fontSize: 'clamp(14px, 1.6vw, 18px)',
              color: 'var(--nb-bone)',
              letterSpacing: '0.04em',
            }}
          >
            {plays} TOTAL PLAYS
            {scoreboardUnlocked ? ` · ${sinceUnlock} SINCE UNLOCK` : ''}
          </div>
        </div>

        {/* CTAs — share actions inline; scoreboard navigation underneath. */}
        <ShareActions picks={priorRun.picks} order={priorRun.order} />
        <Link
          href="/scoreboard"
          className="btn-new"
          data-testid="returning-cta-scoreboard"
          style={{
            fontSize: 'clamp(13px, 1.5vw, 17px)',
            padding: 'clamp(14px, 1.8vw, 20px)',
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
  );
}
