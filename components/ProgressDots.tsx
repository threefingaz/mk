// ProgressDots — minimal "step N of M" affordance.
// Ported from design_handoff_old_blood_new_blood/design-reference/src/system.jsx (ProgressDots).
//
// Renders `total` segments. The segment at `current` is the active step
// (4px tall, outlined). Past segments are filled according to the era the user
// picked at that index (`'old'` → magenta, `'new'` → red). Past segments with
// no recorded pick fall back to a soft white (defensive — shouldn't normally
// happen since picks[i] is always set once i < current). Future segments are
// dim white.
//
// Note: `--ob-magenta` is an alias for `--ob-gold` in styles.css (legacy name
// kept for clarity at call sites).

import type { CSSProperties } from 'react';

export type ProgressDotsProps = {
  total: number;
  current: number;
  picks: ('old' | 'new')[];
};

export function ProgressDots({ total, current, picks }: ProgressDotsProps) {
  const wrap: CSSProperties = {
    display: 'flex',
    gap: 3,
    alignItems: 'center',
  };

  return (
    <div style={wrap} data-testid="progress-dots">
      {Array.from({ length: total }, (_, i) => {
        const done = i < current;
        const active = i === current;
        const era = picks[i];

        let fill: string;
        if (!done && !active) {
          // future
          fill = 'rgba(255,255,255,0.18)';
        } else if (era === 'old') {
          fill = 'var(--ob-magenta)';
        } else if (era === 'new') {
          fill = 'var(--nb-red)';
        } else if (active) {
          // currently selected, no era yet
          fill = 'rgba(255,255,255,0.18)';
        } else {
          // past, somehow no pick recorded — defensive
          fill = 'rgba(255,255,255,0.5)';
        }

        const style: CSSProperties = {
          flex: 1,
          height: active ? 4 : 2,
          background: fill,
          transition: 'all .2s',
          outline: active ? '1px solid var(--nb-bone)' : 'none',
          outlineOffset: 1,
        };

        return <div key={i} style={style} />;
      })}
    </div>
  );
}
