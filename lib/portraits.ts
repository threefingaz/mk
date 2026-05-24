// Portrait manifest resolver.
// Production portraits live at /portraits/<id>-<era>.jpg.
// When a file is missing, the <Portrait> component (Task 4) falls back to
// a <Silhouette> SVG via onError — this resolver always returns the
// canonical URL regardless of whether the file is on disk.

import type { Era, FighterId } from './fighters';

export function portraitFor(fighterId: FighterId, era: Era): string {
  return `/portraits/${fighterId}-${era}.jpg`;
}
