// BrandMark — the "OLD BLOOD // NEW BLOOD" seam logo.
// Ported from design_handoff_old_blood_new_blood/design-reference/src/system.jsx
// (function BrandMark, lines ~71-88).
//
// Horizontal layout (default): three spans laid out as OLD BLOOD // NEW BLOOD.
// Vertical layout: two stacked divs with the new-era cell taking the bottom
// border-top off and inheriting the left/top hairline from the old cell.
//
// Server component — pure presentational, no events.

import type { CSSProperties } from 'react';

export function BrandMark({
  size = 18,
  vertical = false,
}: {
  size?: number | string;
  vertical?: boolean;
}) {
  const base: CSSProperties = { fontSize: size };

  if (vertical) {
    return (
      <div
        className="brand-mark"
        style={{
          ...base,
          flexDirection: 'column',
          alignItems: 'stretch',
          gap: 0,
        }}
      >
        <div className="bm-old" style={{ textAlign: 'center' }}>
          OLD BLOOD
        </div>
        <div
          className="bm-new"
          style={{
            textAlign: 'center',
            borderLeft: '1px solid var(--nb-line)',
            borderTop: 0,
          }}
        >
          NEW BLOOD
        </div>
      </div>
    );
  }

  return (
    <div className="brand-mark" style={base}>
      <span className="bm-old">OLD BLOOD</span>
      <span className="bm-slash">{'//'}</span>
      <span className="bm-new">NEW BLOOD</span>
    </div>
  );
}
