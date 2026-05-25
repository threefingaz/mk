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
// Layout: two EraCards side-by-side at all viewports (old-LEFT, new-RIGHT).
// Mobile baseline is `flex-direction: row` with a 6px gap — the era-split
// background is the only divider (no central seam). At ≥900px the .duel-cards
// rule in globals.css adds a clamp gap, slot max-width cap, and reveals the
// vertical-variant <VsSeam /> between the two cards. Matches the original
// design (design-reference/src/screens.jsx::DuelScreen ~L173). See
// docs/plans/completed/20260524-duel-mobile-side-by-side.md.
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
          padding: 'clamp(24px, 3vw, 48px) clamp(16px, 3vw, 48px) clamp(20px, 2.5vw, 40px)',
          display: 'flex',
          flexDirection: 'column',
          gap: 'clamp(12px, 2vw, 24px)',
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
              gap: 'clamp(18px, 3vw, 36px)',
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
              fontSize: 'clamp(30px, 5vw, 64px)',
              lineHeight: 1,
              color: 'var(--nb-bone)',
              textShadow: '0 2px 12px rgba(0,0,0,0.6)',
              marginTop: 6,
            }}
          >
            {fighter.name.toUpperCase()}
          </div>
        </div>

        {/* Two EraCards — side-by-side on all viewports (old-LEFT,
            new-RIGHT). Matches the original design
            (design-reference/src/screens.jsx::DuelScreen ~L173). Both
            <VsSeam> instances stay rendered so testIds resolve; visibility
            is CSS-controlled via .duel-seam-h / .duel-seam-v.

            Display/flex/gap/min-width all live in .duel-cards / .duel-card-slot
            in app/globals.css so the desktop @media block (gap: clamp(...),
            max-height, slot caps) can override without losing to inline-style
            specificity. The two inline props below (flex: 1, minHeight: 0)
            are flex-*item* declarations against the outer column flex parent
            (fills remaining vertical space inside Duel's top-level column)
            and aren't expressible from a stylesheet without coupling the
            wrapper's parent layout into globals.css. */}
        {/* Both onPick handlers below are structurally symmetric — they differ
            only in the era literal ('old' vs 'new'), the era-specific audio
            sample pair, and the same-era guard condition (pickedOld vs
            pickedNew). The two handlers are kept inline (not extracted) for
            grep-ability of the audio sample calls and to keep each card's
            interaction surface self-contained.

            Same-era retap short-circuits here for UX (no audio jitter, no
            second analytics event). The store also short-circuits as a
            correctness backstop — including against a bounce-tap race where
            two taps queue in one React event flush, since these closures read
            the snapshot at render time and can miss an in-flight pick. The
            store's fresh useRunStore.getState() re-read covers that case.

            Audio: unlockAudio + impact + voice are fire-and-forget. Missing
            samples are silent per CLAUDE.md's "Drop assets in later" pattern. */}
        <div
          className="duel-cards"
          style={{
            flex: 1,
            minHeight: 0,
          }}
        >
          <div className="duel-card-slot">
            <EraCard
              fighter={fighter}
              era="old"
              picked={pickedOld}
              dimmed={pickedNew}
              onPick={() => {
                if (pickedOld) return;
                trackEvent({ name: 'pick', props: { fighter_id: fighter.id, era: 'old', step } });
                void unlockAudio();
                playOldImpact();
                playOldVoice();
                recordPickAndSubmit('old');
              }}
              nameBandMode="actor"
              style={{ flex: 1 }}
            />
          </div>
          {/* Both seam wrappers stay rendered so the testIds resolve; the
              CSS rules in app/globals.css drive visibility (.duel-seam-h
              is always hidden — era-split background divides the two
              halves on mobile; .duel-seam-v shows at ≥900px). */}
          <div className="duel-seam-h">
            <VsSeam vertical testId="vs-seam-h" />
          </div>
          <div className="duel-seam-v">
            <VsSeam vertical={false} testId="vs-seam-v" />
          </div>
          <div className="duel-card-slot">
            <EraCard
              fighter={fighter}
              era="new"
              picked={pickedNew}
              dimmed={pickedOld}
              onPick={() => {
                if (pickedNew) return;
                trackEvent({ name: 'pick', props: { fighter_id: fighter.id, era: 'new', step } });
                void unlockAudio();
                playNewImpact();
                playNewVoice();
                recordPickAndSubmit('new');
              }}
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
              position: 'sticky',
              bottom: 'max(env(safe-area-inset-bottom, 12px), 12px)',
              zIndex: 5,
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
