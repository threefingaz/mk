'use client';

// DuelScreen — the head-to-head pick surface (Task 12).
// Ported from design_handoff_old_blood_new_blood/design-reference/src/screens.jsx
// (function DuelScreen, ~lines 125-260) and design-reference/src/run.jsx's
// pick/next interaction model (idle → pick(era) → pickedOld|pickedNew →
// NEXT FIGHTER → next() → idle for next fighter).
//
// Wiring (production):
//   - State comes from useRunStore: { step, order, picks, duelState,
//     scoreboardUnlocked, crowdStats }; actions: { pick, next }.
//   - The current fighter is resolved as FIGHTERS[order[step]] — the run order
//     is shuffled Fisher-Yates at start() time (lib/store.ts).
//   - Three render branches keyed off duelState:
//       'idle'       — both cards interactive, "TAP TO PICK" hint below.
//       'pickedOld'  — old card stamped picked, new card dimmed; NEXT button.
//       'pickedNew'  — mirrored: new picked, old dimmed; NEXT button.
//   - Post-unlock crowd bar reveal: when scoreboardUnlocked && picked &&
//     crowdStats[fighter.id] is present, an <OldNewBar> renders between the
//     cards and the NEXT button with the `barfill` keyframe animation.
//
// Mobile-first layout: two stacked EraCards (old on top, new on bottom) with
// <VsSeam /> between them. Per Task 12 we ship one layout for v1; the desktop
// side-by-side variant is deferred.
//
// Per the design handoff, the character name lives in a screen-level anchor
// (mono "1995 / 2026" lockup + name) above the cards, so the EraCards use
// nameBandMode="actor" — the card bottom shows only the actor name.

import { ProgressDots } from '@/components/ProgressDots';
import { EraCard } from '@/components/EraCard';
import { VsSeam } from '@/components/VsSeam';
import { OldNewBar } from '@/components/OldNewBar';
import { FIGHTERS } from '@/lib/fighters';
import { useRunStore } from '@/lib/store';
import { trackEvent } from '@/lib/analytics';
import {
  playNewImpact,
  playNewVoice,
  playOldImpact,
  playOldVoice,
  unlockAudio,
} from '@/lib/audio';

export function Duel() {
  const step = useRunStore((s) => s.step);
  const order = useRunStore((s) => s.order);
  const picks = useRunStore((s) => s.picks);
  const duelState = useRunStore((s) => s.duelState);
  const scoreboardUnlocked = useRunStore((s) => s.scoreboardUnlocked);
  const crowdStats = useRunStore((s) => s.crowdStats);
  // recordPickAndSubmit (Task 25) replaces direct pick(era) — combines the
  // pure state mutation with fire-and-forget POST /api/vote. Server-side
  // rate-limit + per-matchup dedupe make failures invisible to the UI.
  const recordPickAndSubmit = useRunStore((s) => s.recordPickAndSubmit);
  const next = useRunStore((s) => s.next);

  // Resolve current fighter via order/step. If order is empty (defensive —
  // start() always populates it before phase flips to 'duel'), bail.
  const fighterIndex = order[step];
  if (fighterIndex === undefined) {
    return null;
  }
  const fighter = FIGHTERS[fighterIndex];

  const pickedOld = duelState === 'pickedOld';
  const pickedNew = duelState === 'pickedNew';
  const picked = pickedOld || pickedNew;

  const crowd = crowdStats[fighter.id];
  const showCrowdBar = scoreboardUnlocked && picked && crowd !== undefined;

  return (
    <div
      data-testid="duel-screen"
      style={{
        position: 'relative',
        width: '100%',
        minHeight: '100vh',
        display: 'flex',
        background: '#000',
      }}
    >
      {/* Split background — vertical era halves so each card sits on its own
          era field. Same skeleton as the prototype, scaled to full screen. */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          pointerEvents: 'none',
        }}
      >
        <div className="era-old" style={{ flex: 1 }} />
        <div className="era-new" style={{ flex: 1 }} />
      </div>

      <div
        style={{
          position: 'relative',
          zIndex: 4,
          flex: 1,
          padding: '24px 16px 20px',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          minHeight: 0,
        }}
      >
        {/* Top — progress (step-of-9 + dots). */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div
            className="nb-mono"
            style={{
              fontSize: 10,
              color: 'var(--nb-bone)',
              letterSpacing: '0.2em',
              textAlign: 'right',
            }}
          >
            {String(step + 1).padStart(2, '0')}/09
          </div>
          <ProgressDots total={9} current={step} picks={picks} />
        </div>

        {/* Character anchor — small mono year lockups + character name.
            Per Task 12 spec, "1995" sits in .ob-display on the old side and
            "2026" sits in .nb-display on the new side; the character name is
            the headline below. The EraCards use nameBandMode="actor" so the
            character name only appears here. */}
        <div style={{ textAlign: 'center', marginTop: 2 }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'baseline',
              gap: 18,
            }}
          >
            <span
              className="ob-display ob-chromatic"
              style={{
                fontSize: 12,
                color: 'var(--ob-bone)',
                letterSpacing: '0.08em',
              }}
            >
              1995
            </span>
            <span
              className="nb-mono"
              style={{
                fontSize: 9,
                color: 'var(--nb-mute)',
                letterSpacing: '0.3em',
              }}
            >
              WHICH IS BETTER
            </span>
            <span
              className="nb-display nb-condensed"
              style={{
                fontSize: 12,
                color: 'var(--nb-red)',
                letterSpacing: '0.18em',
              }}
            >
              2026
            </span>
          </div>
          <div
            className="nb-display nb-condensed"
            style={{
              fontSize: 30,
              lineHeight: 1,
              color: 'var(--nb-bone)',
              textShadow: '0 2px 12px rgba(0,0,0,0.6)',
              marginTop: 6,
            }}
          >
            {fighter.name.toUpperCase()}
          </div>
        </div>

        {/* Two stacked EraCards with VsSeam between them.
            Mobile-first single layout per Task 12. */}
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'stretch',
            gap: 0,
            minHeight: 0,
          }}
        >
          <div style={{ display: 'flex' }}>
            <EraCard
              fighter={fighter}
              era="old"
              picked={pickedOld}
              dimmed={pickedNew}
              onPick={
                picked
                  ? undefined
                  : () => {
                      trackEvent({ name: 'pick', props: { fighter_id: fighter.id, era: 'old', step } });
                      // Audio: first-gesture unlock + impact + voice are all
                      // fire-and-forget. Missing samples are silent (Task 18).
                      void unlockAudio();
                      playOldImpact();
                      playOldVoice();
                      recordPickAndSubmit('old');
                    }
              }
              nameBandMode="actor"
              style={{ flex: 1 }}
            />
          </div>
          <VsSeam vertical />
          <div style={{ display: 'flex' }}>
            <EraCard
              fighter={fighter}
              era="new"
              picked={pickedNew}
              dimmed={pickedOld}
              onPick={
                picked
                  ? undefined
                  : () => {
                      trackEvent({ name: 'pick', props: { fighter_id: fighter.id, era: 'new', step } });
                      void unlockAudio();
                      playNewImpact();
                      playNewVoice();
                      recordPickAndSubmit('new');
                    }
              }
              nameBandMode="actor"
              style={{ flex: 1 }}
            />
          </div>
        </div>

        {/* Crowd bar — post-unlock reveal, between cards and NEXT button.
            Uses the `barfill` keyframe from globals.css (Task 2 port). */}
        {showCrowdBar && (
          <div
            data-testid="duel-crowd-bar"
            style={{
              animation: 'barfill 600ms ease-out',
              overflow: 'hidden',
            }}
          >
            <div
              className="nb-mono"
              style={{
                fontSize: 9,
                letterSpacing: '0.22em',
                color: 'var(--nb-mute)',
                marginBottom: 4,
              }}
            >
              THE CROWD SAYS
            </div>
            <OldNewBar oldPicks={crowd.old} newPicks={crowd.new} height={16} />
          </div>
        )}

        {/* Bottom CTA row — depends on duelState. */}
        {!picked && (
          <div
            data-testid="duel-tap-hint"
            className="nb-mono"
            style={{
              textAlign: 'center',
              fontSize: 11,
              letterSpacing: '0.25em',
              color: 'var(--nb-mute)',
              padding: '10px 4px',
            }}
          >
            TAP TO PICK
          </div>
        )}

        {picked && (
          <button
            type="button"
            className="btn-new btn-new-red"
            onClick={() => next()}
            data-testid="duel-next"
            style={{
              alignSelf: 'stretch',
              textAlign: 'center',
              justifyContent: 'center',
              padding: '14px',
              fontSize: 15,
              letterSpacing: '0.12em',
            }}
          >
            NEXT FIGHTER ›
          </button>
        )}
      </div>
    </div>
  );
}
