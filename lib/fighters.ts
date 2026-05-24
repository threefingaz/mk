// Typed FIGHTERS data — the canonical 9 head-to-head matchups.
// Copied verbatim from design_handoff_old_blood_new_blood/design-reference/src/system.jsx
// Order shuffles per session in production (lib/store.ts); this is the canon order.

export type Era = 'old' | 'new';

export type FighterId =
  | 'raiden'
  | 'liukang'
  | 'johnnycage'
  | 'sonya'
  | 'kitana'
  | 'shangtsung'
  | 'kano'
  | 'scorpion'
  | 'subzero';

export type SilhouetteKind = 'stance' | 'guard' | 'robe' | 'cape' | 'fourarm';

export type Fighter = {
  id: FighterId;
  name: string;
  oldActor: string;
  newActor: string;
  oldTag: string;
  newTag: string;
  silhouette: SilhouetteKind;
};

export const FIGHTERS: readonly Fighter[] = [
  { id: 'raiden', name: 'Raiden', oldActor: 'Christopher Lambert', newActor: 'Tadanobu Asano', oldTag: 'RAID.MMXCV', newTag: 'RAID-26', silhouette: 'robe' },
  { id: 'liukang', name: 'Liu Kang', oldActor: 'Robin Shou', newActor: 'Ludi Lin', oldTag: 'LIUK.MMXCV', newTag: 'LIUK-26', silhouette: 'stance' },
  { id: 'johnnycage', name: 'Johnny Cage', oldActor: 'Linden Ashby', newActor: 'Karl Urban', oldTag: 'CAGE.MMXCV', newTag: 'CAGE-26', silhouette: 'guard' },
  { id: 'sonya', name: 'Sonya Blade', oldActor: 'Bridgette Wilson', newActor: 'Jessica McNamee', oldTag: 'SONY.MMXCV', newTag: 'SONY-26', silhouette: 'guard' },
  { id: 'kitana', name: 'Kitana', oldActor: 'Talisa Soto', newActor: 'Adeline Rudolph', oldTag: 'KITA.MMXCV', newTag: 'KITA-26', silhouette: 'cape' },
  { id: 'shangtsung', name: 'Shang Tsung', oldActor: 'Cary-Hiroyuki Tagawa', newActor: 'Chin Han', oldTag: 'SHNG.MMXCV', newTag: 'SHNG-26', silhouette: 'robe' },
  { id: 'kano', name: 'Kano', oldActor: 'Trevor Goddard', newActor: 'Josh Lawson', oldTag: 'KANO.MMXCV', newTag: 'KANO-26', silhouette: 'stance' },
  { id: 'scorpion', name: 'Scorpion', oldActor: 'Chris Casamassa', newActor: 'Hiroyuki Sanada', oldTag: 'SCRP.MMXCV', newTag: 'SCRP-26', silhouette: 'stance' },
  { id: 'subzero', name: 'Sub-Zero', oldActor: 'François Petit', newActor: 'Joe Taslim', oldTag: 'SUB0.MMXCV', newTag: 'SUB0-26', silhouette: 'cape' },
] as const;

export function getFighter(id: FighterId): Fighter {
  // Non-null assertion is safe: FighterId is a closed union of the 9 ids above.
  return FIGHTERS.find((f) => f.id === id)!;
}
