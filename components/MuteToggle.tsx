'use client';

// MuteToggle — bottom-right affordance for the audio mute state.
//
// Currently a pure controlled component: parent passes `muted` and `onToggle`.
// Task 17/17b will wire it to the Zustand identity slice (created in Task 9)
// at the layout level so callers don't have to thread props.
//
// Labels:
//   muted=true  → "SOUND OFF · TAP TO ENABLE"
//   muted=false → "SOUND ON" + pulsing red dot (uses the `pulse-red` keyframes
//                 already defined in globals.css)
//
// Hit target ≥ 44×44 per accessibility guidance.
// `.mute-dot` is not defined in globals.css; the dot is inlined.

import type { CSSProperties } from 'react';

const buttonStyle: CSSProperties = {
  position: 'fixed',
  right: 12,
  bottom: 12,
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
}: {
  muted: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      className="mute-toggle"
      style={buttonStyle}
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
