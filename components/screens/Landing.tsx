'use client';

// LandingScreen — the entry surface (Task 11).
// Ported from design_handoff_old_blood_new_blood/design-reference/src/screens.jsx
// (function LandingScreen, lines ~23-120), trimmed to the production scope:
//
//   - Vertical era split (left .era-old, right .era-new) with a 1px seam down
//     the middle.
//   - Vertical <BrandMark vertical /> straddling the seam (centered).
//   - One large FIGHT CTA (.btn-new.btn-new-red) → useRunStore.getState().start()
//     flips phase to 'duel'.
//   - Pre-unlock chip: countdown "PLAYS UNTIL SCOREBOARD UNLOCKS · {playsUntil}".
//   - Post-unlock chip: short scoreboard summary "BOARD LIVE · {plays} PLAYS LOGGED".
//     Full scoreboard detail lives on /scoreboard.
//   - Fine-print line: "9 ROUNDS · ~90 SECONDS · NO ACCOUNT" in nb-mono.
//
// Per the plan's "Alternative" note on Task 11, this component takes `plays` and
// `threshold` as PROPS (cleaner separation; app/page.tsx will pass them once it
// reads /api/results in Task 25). The `scoreboardUnlocked` flag is read directly
// from the store via a hook.

import { BrandMark } from '@/components/BrandMark';
import { useRunStore } from '@/lib/store';
import { trackEvent } from '@/lib/analytics';
import { unlockAudio } from '@/lib/audio';

export type LandingProps = {
  /** Total completed plays from the server. Default 0 for first render. */
  plays?: number;
  /** Unlock threshold (REVEAL_AT). Default 30 to match prod. */
  threshold?: number;
};

export function Landing({ plays = 0, threshold = 30 }: LandingProps) {
  // Read unlock state from the store directly (per Task 11 spec).
  const unlocked = useRunStore((s) => s.scoreboardUnlocked);
  const start = useRunStore((s) => s.start);

  // Derive playsUntil from the (threshold - plays) delta, clamped to 0+.
  const playsUntil = Math.max(0, threshold - plays);

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        minHeight: '100vh',
        display: 'flex',
        background: '#000',
      }}
    >
      {/* Vertical era split — left old, right new. Hard 1px seam down middle. */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          pointerEvents: 'none',
        }}
      >
        <div className="era-old" style={{ flex: 1 }} />
        <div className="era-new" style={{ flex: 1 }} />
        {/* 1px seam straddling the split. */}
        <div
          aria-hidden
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            left: '50%',
            width: 1,
            transform: 'translateX(-0.5px)',
            background: 'var(--nb-line, rgba(255,255,255,0.18))',
          }}
        />
      </div>

      {/* Foreground content */}
      <div
        style={{
          position: 'relative',
          zIndex: 4,
          flex: 1,
          padding: '48px 24px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 28,
          textAlign: 'center',
        }}
      >
        {/* Vertical BrandMark straddling the seam (horizontally centered). */}
        <BrandMark size={28} vertical />

        {/* Pre / post-unlock chip. */}
        {unlocked ? (
          <div
            className="nb-mono"
            style={{
              fontSize: 11,
              letterSpacing: '0.2em',
              color: 'var(--nb-bone)',
              padding: '6px 12px',
              border: '1px solid var(--nb-red)',
              background: 'rgba(0,0,0,0.4)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <span
              aria-hidden
              style={{
                width: 8,
                height: 8,
                background: 'var(--nb-red)',
                display: 'inline-block',
                animation: 'pulse-red 1.6s infinite',
              }}
            />
            BOARD LIVE · {plays} PLAYS LOGGED
          </div>
        ) : (
          <div
            className="nb-mono"
            style={{
              fontSize: 10,
              letterSpacing: '0.2em',
              color: 'var(--nb-mute, rgba(255,255,255,0.7))',
              padding: '6px 12px',
              border: '1px solid rgba(255,255,255,0.18)',
              background: 'rgba(0,0,0,0.4)',
            }}
          >
            PLAYS UNTIL SCOREBOARD UNLOCKS · {playsUntil}
          </div>
        )}

        {/* Primary CTA — FIGHT. */}
        <button
          type="button"
          className="btn-new btn-new-red"
          onClick={() => {
            // First user gesture — unlock the AudioContext now so subsequent
            // duel-screen taps can actually play sound (browsers gate
            // AudioContext.resume() behind a user-initiated event).
            // Fire-and-forget; no-op subsequent calls.
            void unlockAudio();
            trackEvent({ name: 'run_start' });
            start();
          }}
          style={{
            fontSize: 22,
            letterSpacing: '0.12em',
            padding: '22px 56px',
            marginTop: 8,
          }}
        >
          FIGHT
        </button>

        {/* Fine print. */}
        <small
          className="nb-mono"
          style={{
            fontSize: 10,
            letterSpacing: '0.22em',
            color: 'rgba(255,255,255,0.6)',
          }}
        >
          9 ROUNDS · ~90 SECONDS · NO ACCOUNT
        </small>
      </div>
    </div>
  );
}
