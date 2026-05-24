// VsSeam — the "VS" plate between the two era columns on the duel screen.
//
// `vertical=true` (default, mobile) sits between vertically stacked cards;
// the seam line runs HORIZONTALLY through the VS label.
// `vertical=false` (desktop) sits between side-by-side cards; the seam line
// runs VERTICALLY through the VS label.
//
// The line is rendered as TWO gradient segments flanking the label so the
// line visually passes THROUGH the VS instead of sitting as a 60px stub
// next to it. Each segment fades from transparent at the outer edge to red
// at the label, producing a continuous "/" between the two era columns.

import type { CSSProperties } from 'react';

export type VsSeamProps = {
  vertical?: boolean;
  /** Override the `data-testid` (defaults to `vs-seam`). Duel renders TWO
   *  VsSeams (one mobile-only, one desktop-only) and passes distinct ids so
   *  `getByTestId` doesn't trip strict-mode on duplicate matches. */
  testId?: string;
};

export function VsSeam({ vertical = true, testId = 'vs-seam' }: VsSeamProps) {
  // `vertical=true` (mobile) → seam BETWEEN stacked cards → line is
  // horizontal → flex-direction: row so the two line segments flank VS
  // along the x-axis. The reverse holds for desktop.
  const horizontalLine = vertical;

  const wrap: CSSProperties = {
    display: 'flex',
    flexDirection: horizontalLine ? 'row' : 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    padding: horizontalLine ? '12px 0' : '0 12px',
    width: '100%',
    height: '100%',
  };

  const label: CSSProperties = {
    flex: '0 0 auto',
    fontSize: 28,
    lineHeight: 1,
    color: 'var(--nb-red)',
    textShadow: '0 0 18px var(--nb-red)',
  };

  // Both segments stretch to fill the perpendicular axis. The outer edge of
  // each fades to transparent so the seam blends into the cards above/below
  // (or left/right of) the label.
  const segmentBase: CSSProperties = {
    flex: '1 1 auto',
    width: horizontalLine ? 'auto' : 1,
    height: horizontalLine ? 1 : 'auto',
  };

  const leadSegment: CSSProperties = {
    ...segmentBase,
    background: horizontalLine
      ? 'linear-gradient(to right, transparent, var(--nb-red))'
      : 'linear-gradient(to bottom, transparent, var(--nb-red))',
  };

  const trailSegment: CSSProperties = {
    ...segmentBase,
    background: horizontalLine
      ? 'linear-gradient(to right, var(--nb-red), transparent)'
      : 'linear-gradient(to bottom, var(--nb-red), transparent)',
  };

  return (
    <div style={wrap} data-testid={testId}>
      <div style={leadSegment} aria-hidden />
      <div className="nb-display nb-condensed" style={label}>
        VS
      </div>
      <div style={trailSegment} aria-hidden />
    </div>
  );
}
