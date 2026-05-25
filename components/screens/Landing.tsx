"use client";

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
//   - Fine-print line: "9 ROUNDS · ~90 SECONDS" in nb-mono.
//
// Per the plan's "Alternative" note on Task 11, this component takes `plays` and
// `threshold` as PROPS (cleaner separation; app/page.tsx will pass them once it
// reads /api/results in Task 25). The `scoreboardUnlocked` flag is read directly
// from the store via a hook.

import { BrandMark } from "@/components/BrandMark";
import { LandingPortraitColumn } from "@/components/LandingPortraitColumn";
import { MuteToggle } from "@/components/MuteToggle";
import { useIdentityStore, useRunStore } from "@/lib/store";
import { trackEvent } from "@/lib/analytics";
import { setMuted as setAudioMuted, unlockAudio } from "@/lib/audio";

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

  // Inline MuteToggle lives directly above the FIGHT button so the audio
  // choice is front-and-center before the first sample plays. The global
  // fixed MuteToggle is suppressed on Landing (see app/page.tsx) to avoid
  // a duplicate control. Toggle logic mirrors app/page.tsx: sync audio
  // module + identity store, and treat an unmute click as the gesture
  // that unlocks the AudioContext.
  const muted = useIdentityStore((s) => s.muted);
  const setMuted = useIdentityStore((s) => s.setMuted);
  const handleMuteToggle = () => {
    const nextMuted = !muted;
    setAudioMuted(nextMuted);
    setMuted(nextMuted);
    if (!nextMuted) void unlockAudio();
  };

  // Derive playsUntil from the (threshold - plays) delta, clamped to 0+.
  const playsUntil = Math.max(0, threshold - plays);

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        minHeight: "100vh",
        display: "flex",
        background: "#000",
      }}
    >
      {/* Vertical era split — left old, right new. Hard 1px seam down middle. */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          pointerEvents: "none",
        }}
      >
        {/* .era-old / .era-new already declare `position: relative` and
            `overflow: hidden` in globals.css (~L79-80, ~L180-181) — no need
            to repeat them inline. `flex: 1` is the only layout-level value
            the inline style adds.

            Stacking note (intentional, asymmetric per era): the marquee
            column nests INSIDE .era-old / .era-new but composites
            differently against each side's pseudo-elements.
            - .era-old: ::before (scanlines, z=2, mix-blend-mode: multiply)
              and ::after (tape-tracking, z=3) paint OVER the marquee
              (z=auto) — both via explicit z-index in globals.css.
            - .era-new: ::before (grid) and ::after (lightning) declare
              NO z-index, so they participate in the parent's stacking
              context at z=auto and resolve by DOM order. Result: ::before
              paints first, then the marquee column, then ::after — so
              grid is BELOW the marquee, lightning is ABOVE it.
            Either way, the marquee is a decorative backdrop (opacity
            0.25) and era treatments compositing over it is the intended
            "subtle behind the FIGHT CTA" effect — same end result, even
            though the mechanism differs per era. Don't promote .era-old
            / .era-new to their own stacking contexts (would break the
            era CSS contract) or lift the marquee out — both regress
            silently. */}
        <div className="era-old" style={{ flex: 1 }}>
          <LandingPortraitColumn era="old" direction="down" />
        </div>
        <div className="era-new" style={{ flex: 1 }}>
          <LandingPortraitColumn era="new" direction="up" />
        </div>
        {/* 1px seam straddling the split. */}
        <div
          aria-hidden
          style={{
            position: "absolute",
            top: 0,
            bottom: 0,
            left: "50%",
            width: 1,
            transform: "translateX(-0.5px)",
            background: "var(--nb-line, rgba(255,255,255,0.18))",
            zIndex: 2,
          }}
        />
        {/* Center vignette — darkens the marquee at the seam where text lives,
            leaves it visible at the edges so the motion still reads.
            Stacking note: .era-old::after paints at z-index: 3 (globals.css
            ~L111); .era-new::after declares no z-index (z=auto). Neither
            .era-* wrapper forms its own stacking context (position: relative
            without z-index), so all those pseudo-elements participate in the
            parent flex container's context. The vignette (z=3) must paint
            AFTER them to dim the seam — guaranteed today because it comes
            LATER in document order than both .era-old and .era-new (DOM
            order breaks z-index ties at z=3 against .era-old::after, and
            z=3 trivially beats z=auto for .era-new::after). Don't reorder
            the JSX without also assigning explicit z-indices. */}
        <div
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 3,
            pointerEvents: "none",
            background:
              "radial-gradient(ellipse at center, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0.4) 35%, transparent 70%)",
          }}
        />
      </div>

      {/* Foreground content */}
      <div
        style={{
          position: "relative",
          zIndex: 4,
          flex: 1,
          padding: "clamp(48px, 6vw, 96px) clamp(24px, 5vw, 64px)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "clamp(28px, 3.5vw, 48px)",
          textAlign: "center",
        }}
      >
        {/* Vertical BrandMark straddling the seam (horizontally centered). */}
        <BrandMark size="clamp(28px, 4vw, 48px)" vertical />

        {/* Pre / post-unlock status. Borderless + no fill so this doesn't
            visually compete with the MuteToggle button sitting below it
            (interactive controls own the bordered-chip treatment). */}
        {unlocked ? (
          <div
            className="nb-mono"
            style={{
              fontSize: "clamp(11px, 1.2vw, 14px)",
              letterSpacing: "0.2em",
              color: "var(--nb-bone)",
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <span
              aria-hidden
              style={{
                width: 8,
                height: 8,
                background: "var(--nb-red)",
                display: "inline-block",
                animation: "pulse-red 1.6s infinite",
              }}
            />
            BOARD LIVE · {plays} PLAYS LOGGED
          </div>
        ) : (
          <div
            className="nb-mono"
            style={{
              fontSize: "clamp(10px, 1.1vw, 13px)",
              letterSpacing: "0.2em",
              color: "var(--nb-mute, rgba(255,255,255,0.7))",
            }}
          >
            PLAYS UNTIL SCOREBOARD UNLOCKS · {playsUntil}
          </div>
        )}

        {/* Sound toggle — inline above the FIGHT button so the choice is
            visible before the first audio plays. */}
        <MuteToggle muted={muted} onToggle={handleMuteToggle} inline />

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
            trackEvent({ name: "run_start" });
            start();
          }}
          style={{
            fontSize: "clamp(22px, 2.6vw, 36px)",
            letterSpacing: "0.12em",
            padding: "clamp(22px, 2.5vw, 32px) clamp(56px, 7vw, 96px)",
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
            letterSpacing: "0.22em",
            color: "rgba(255,255,255,0.6)",
          }}
        >
          9 ROUNDS · ~90 SECONDS
        </small>
      </div>
    </div>
  );
}
