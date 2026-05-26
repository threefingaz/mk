'use client';

// MuteToggle — audio mute affordance.
//
// Two layout variants share the same visual treatment and labels:
//   default       — position: fixed at bottom-right of the viewport.
//                   Persistent overlay during in-run screens (Duel / Verdict /
//                   Share) where the user might want to toggle audio mid-flow.
//   inline=true   — normal-flow inline-flex, no positioning. Used on the
//                   Landing screen above the FIGHT button so the choice is
//                   front-and-center before the first audio plays.
//
// Pure controlled component: parent passes `muted` and `onToggle`.
//
// Labels:
//   muted=true  → "SOUND OFF · TAP TO ENABLE"
//   muted=false → "SOUND ON" + pulsing red dot (uses the `pulse-red` keyframes
//                 already defined in globals.css)
//
// Hit target ≥ 44×44 per accessibility guidance.
// `.mute-dot` is not defined in globals.css; the dot is inlined.

import type { CSSProperties } from 'react';

const baseStyle: CSSProperties = {
  minWidth: 44,
  minHeight: 44,
  padding: '10px 14px',
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
  background: 'oklch(0 0 0 / 0.4)',
  border: '1px solid oklch(1 0 0 / 0.2)',
  color: 'oklch(1 0 0 / 0.7)',
  fontFamily: 'var(--f-mono-new)',
  fontSize: 10,
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
  cursor: 'pointer',
};

const fixedStyle: CSSProperties = {
  ...baseStyle,
  position: 'fixed',
  right: 12,
  bottom: 12,
  zIndex: 50,
};

// Top-right variant — used on screens with a sticky bottom CTA (e.g. Duel)
// so the toggle doesn't sit on top of the CTA's right-edge tap area.
const fixedTopRightStyle: CSSProperties = {
  ...baseStyle,
  position: 'fixed',
  right: 12,
  top: 12,
  zIndex: 50,
};

const dotStyle: CSSProperties = {
  display: 'inline-block',
  width: 8,
  height: 8,
  borderRadius: '50%',
  background: 'oklch(0.58 0.24 27)',
  animation: 'pulse-red 1.6s ease-in-out infinite',
};

export function MuteToggle({
  muted,
  onToggle,
  inline = false,
  placement = 'bottom-right',
}: {
  muted: boolean;
  onToggle: () => void;
  /** When true, renders in normal flow (no `position: fixed`). Default false. */
  inline?: boolean;
  /** Fixed-mode placement. Default 'bottom-right'. Use 'top-right' on screens
   *  with a sticky bottom CTA so the toggle doesn't obscure the CTA. Ignored
   *  when inline=true. */
  placement?: 'bottom-right' | 'top-right';
}) {
  const fixedVariant = placement === 'top-right' ? fixedTopRightStyle : fixedStyle;
  return (
    <button
      type="button"
      className="mute-toggle"
      style={inline ? baseStyle : fixedVariant}
      onClick={onToggle}
      aria-pressed={!muted}
      aria-label={muted ? 'Enable sound' : 'Mute sound'}
    >
      {muted ? (
        <span>SOUND OFF · TAP TO ENABLE</span>
      ) : (
        <>
          <span className="mute-dot" style={dotStyle} aria-hidden="true" />
          <span>SOUND ON</span>
        </>
      )}
    </button>
  );
}
