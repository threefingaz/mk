// OldNewBar — horizontal split bar comparing old vs new pick counts.
// Ported from design_handoff_old_blood_new_blood/design-reference/src/cards.jsx
// (OldNewBar). The prototype hard-coded the denominator at 9; this port
// derives it from `oldPicks + newPicks` so the bar is a pure function of its
// inputs. For the canonical 9-fighter run the two are mathematically
// identical.
//
// Zero-state (oldPicks=0 && newPicks=0) renders a symmetric 50/50 split so
// the visual doesn't lie ("100% new era" with no data is misleading). Both
// labels still render as "OLD · 0" / "NEW · 0".
//
// Left half: repeating diagonal stripe (blood + magenta) with mono OLD · N
// label. Right half: ink → red horizontal gradient with mono NEW · N label
// right-anchored.

import type { CSSProperties } from 'react';

export type OldNewBarProps = {
  oldPicks: number;
  newPicks: number;
  /** Bar height in pixels (number) or any CSS length, e.g. a `clamp()`
   *  expression to scale with viewport. Defaults to 16px. */
  height?: number | string;
  style?: CSSProperties;
};

export function OldNewBar({
  oldPicks,
  newPicks,
  height = 16,
  style,
}: OldNewBarProps) {
  const total = oldPicks + newPicks;
  const oldPct = total === 0 ? 50 : (oldPicks / total) * 100;
  const newPct = 100 - oldPct;

  return (
    <div
      data-testid="old-new-bar"
      style={{
        display: 'flex',
        height,
        width: '100%',
        border: '1px solid rgba(0,0,0,0.4)',
        ...style,
      }}
    >
      <div
        data-testid="old-new-bar-old"
        style={{
          width: `${oldPct}%`,
          background:
            'repeating-linear-gradient(45deg, var(--ob-blood) 0 8px, var(--ob-magenta) 8px 16px)',
          position: 'relative',
        }}
      >
        <div
          style={{
            position: 'absolute',
            left: 6,
            top: '50%',
            transform: 'translateY(-50%)',
            fontFamily: 'var(--f-mono-old)',
            fontSize: 12,
            color: 'var(--ob-bone)',
            textShadow: '1px 1px 0 var(--ob-ink)',
          }}
        >
          OLD · {oldPicks}
        </div>
      </div>
      <div
        data-testid="old-new-bar-new"
        style={{
          width: `${newPct}%`,
          background: 'linear-gradient(90deg, var(--nb-ink), var(--nb-red))',
          position: 'relative',
        }}
      >
        <div
          style={{
            position: 'absolute',
            right: 6,
            top: '50%',
            transform: 'translateY(-50%)',
            fontFamily: 'var(--f-mono-new)',
            fontSize: 10,
            color: 'var(--nb-bone)',
            letterSpacing: '0.1em',
          }}
        >
          NEW · {newPicks}
        </div>
      </div>
    </div>
  );
}
