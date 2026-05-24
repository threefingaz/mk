// Silhouette — era-treated SVG mask placeholder for missing portraits.
// Ported verbatim from design_handoff_old_blood_new_blood/design-reference/src/system.jsx
// (SILHOUETTES dict + Silhouette component, lines 26–66).
//
// The 5 inline SVG masks (stance / guard / robe / cape / fourarm) are abstract
// fighter shapes — recognizably "a fighter," not a specific person. They paint
// via CSS mask (see .silhouette / .silhouette-old / .silhouette-new in globals.css).
//
// Server component — no event handlers, no client state.

import type { Era, SilhouetteKind } from '@/lib/fighters';

const SILHOUETTES: Record<SilhouetteKind, string> = {
  stance: `data:image/svg+xml;utf8,${encodeURIComponent(`
    <svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 140'>
      <ellipse cx='52' cy='20' rx='9' ry='10' fill='black'/>
      <path d='M40 32 L65 32 L72 56 L78 80 L70 82 L62 60 L60 88 L66 130 L56 130 L52 96 L48 130 L38 130 L42 88 L40 60 L30 84 L22 80 L30 56 Z' fill='black'/>
    </svg>`)}`,
  guard: `data:image/svg+xml;utf8,${encodeURIComponent(`
    <svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 140'>
      <ellipse cx='50' cy='22' rx='10' ry='11' fill='black'/>
      <path d='M38 34 L62 34 L70 50 L66 64 L58 60 L56 58 L56 92 L62 130 L52 130 L50 100 L48 130 L38 130 L44 92 L44 58 L42 60 L34 64 L30 50 Z' fill='black'/>
    </svg>`)}`,
  robe: `data:image/svg+xml;utf8,${encodeURIComponent(`
    <svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 140'>
      <ellipse cx='50' cy='18' rx='9' ry='10' fill='black'/>
      <path d='M34 32 L66 32 L80 70 L82 130 L18 130 L20 70 Z' fill='black'/>
      <path d='M48 32 L52 32 L52 130 L48 130 Z' fill='black' opacity='0.3'/>
    </svg>`)}`,
  cape: `data:image/svg+xml;utf8,${encodeURIComponent(`
    <svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 140'>
      <ellipse cx='50' cy='20' rx='9' ry='10' fill='black'/>
      <path d='M30 36 L70 36 L86 90 L92 130 L62 130 L60 80 L56 90 L52 130 L48 130 L44 90 L40 80 L38 130 L8 130 L14 90 Z' fill='black'/>
    </svg>`)}`,
  fourarm: `data:image/svg+xml;utf8,${encodeURIComponent(`
    <svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 140'>
      <ellipse cx='50' cy='20' rx='10' ry='11' fill='black'/>
      <path d='M32 34 L68 34 L82 60 L78 76 L66 70 L62 56 L60 90 L66 130 L54 130 L52 100 L48 100 L46 130 L34 130 L40 90 L38 56 L34 70 L22 76 L18 60 Z' fill='black'/>
      <path d='M28 50 L18 80 L10 78 L20 44 Z M72 50 L82 80 L90 78 L80 44 Z' fill='black'/>
    </svg>`)}`,
};

export function Silhouette({ kind, era }: { kind: SilhouetteKind; era: Era }) {
  const svg = SILHOUETTES[kind];
  return (
    <div
      className={`silhouette silhouette-${era}`}
      style={{ '--silhouette-svg': `url("${svg}")` } as React.CSSProperties}
    />
  );
}
