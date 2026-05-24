// DisclaimerRibbon — persistent legal positioning ribbon at the bottom of
// every screen. Copy is verbatim from design_handoff_old_blood_new_blood/README.md
// (Legal positioning section).
//
// `.disclaimer-ribbon` is not (yet) defined in globals.css, so the small style
// block is inlined here per Task 5's guidance (don't add new global rules for
// thin one-off primitives).
//
// Server component — pure presentational, no events.

import type { CSSProperties } from 'react';

const RIBBON_TEXT =
  'UNOFFICIAL FAN PROJECT · NOT AFFILIATED WITH WARNER BROS., NEW LINE OR NETHERREALM · NO ADS, NO MONETIZATION';

const ribbonStyle: CSSProperties = {
  fontFamily: 'var(--f-mono-new)',
  fontSize: 10,
  letterSpacing: '0.08em',
  color: 'oklch(1 0 0 / 0.4)',
  padding: '8px 12px',
  textAlign: 'center',
  textTransform: 'uppercase',
  lineHeight: 1.4,
};

export function DisclaimerRibbon() {
  return (
    <div className="disclaimer-ribbon" style={ribbonStyle}>
      {RIBBON_TEXT}
    </div>
  );
}
