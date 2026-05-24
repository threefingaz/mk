// VsSeam — the "VS" plate between the two era columns on the duel screen.
// Ported from design_handoff_old_blood_new_blood/design-reference/src/system.jsx (VsSeam).
//
// `vertical` (default true) stacks the VS label above the flanking gradient
// line; `vertical={false}` lays them side-by-side. The label uses the New
// Blood condensed display face at 28px in --nb-red, with an 18px red glow.

import type { CSSProperties } from 'react';

export type VsSeamProps = {
  vertical?: boolean;
  /** Override the `data-testid` (defaults to `vs-seam`). Duel renders TWO
   *  VsSeams (one mobile-only, one desktop-only) and passes distinct ids so
   *  `getByTestId` doesn't trip strict-mode on duplicate matches. */
  testId?: string;
};

export function VsSeam({ vertical = true, testId = 'vs-seam' }: VsSeamProps) {
  const wrap: CSSProperties = {
    display: 'flex',
    flexDirection: vertical ? 'column' : 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    padding: vertical ? '12px 0' : '0 12px',
  };

  const label: CSSProperties = {
    fontSize: 28,
    lineHeight: 1,
    color: 'var(--nb-red)',
    textShadow: '0 0 18px var(--nb-red)',
  };

  // NOTE: when `vertical={false}` (desktop horizontal layout), the line
  // element uses `flex: 1 1 auto` — callers MUST place this seam in a
  // content-sized parent (not a parent that grants arbitrary extra space)
  // or the line will stretch unexpectedly. Duel wraps each seam in
  // `.duel-seam-h` / `.duel-seam-v` which are content-sized.
  const line: CSSProperties = {
    flex: vertical ? '0 0 auto' : '1 1 auto',
    width: vertical ? 60 : 1,
    height: vertical ? 1 : 60,
    background: vertical
      ? 'linear-gradient(to right, transparent, var(--nb-red), transparent)'
      : 'linear-gradient(to bottom, transparent, var(--nb-red), transparent)',
  };

  return (
    <div style={wrap} data-testid={testId}>
      <div className="nb-display nb-condensed" style={label}>
        VS
      </div>
      <div style={line} />
    </div>
  );
}
