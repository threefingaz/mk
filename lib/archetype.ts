// Archetype derivation (Task 10).
//
// Five archetype outcomes keyed by `oldPicks` in 0..9.
// Lifted verbatim from design_handoff_old_blood_new_blood/design-reference/src/cards.jsx
// (top of file, the ARCHETYPE_SETS.A object and the archetypeFor() lookup).
//
// Per Q12G the prototype copy ships as-is.

export type Lean = 'old' | 'split' | 'new';

export type Archetype = {
  range: readonly [number, number];
  name: string;
  lean: Lean;
};

export type ArchetypeSetKey = 'A';

type ArchetypeSet = {
  label: string;
  items: readonly Archetype[];
};

export const ARCHETYPE_SETS: { readonly [K in ArchetypeSetKey]: ArchetypeSet } = {
  A: {
    label: 'Brief baseline',
    items: [
      { range: [8, 9], name: '90s Die-Hard', lean: 'old' },
      { range: [6, 7], name: 'Old Guard', lean: 'old' },
      { range: [4, 5], name: 'Switch-Hitter', lean: 'split' },
      { range: [2, 3], name: 'New Convert', lean: 'new' },
      { range: [0, 1], name: 'New Blood', lean: 'new' },
    ],
  },
} as const;

/**
 * Returns the archetype matching `oldPicks` (count of 'old' picks across the 9 duels).
 *
 * Input domain is the closed integer range 0..9 inclusive (the natural domain
 * of a length-9 picks array). Out-of-range values throw via the array lookup
 * returning undefined — TypeScript's exact-bounds contract documents the rest.
 */
export function archetypeFor(oldPicks: number, setKey: ArchetypeSetKey = 'A'): Archetype {
  if (oldPicks < 0 || oldPicks > 9) {
    throw new RangeError(`archetypeFor: oldPicks must be within 0..9, got ${oldPicks}`);
  }
  const items = ARCHETYPE_SETS[setKey].items;
  // Ranges cover 0..9 contiguously, so a match always exists for in-range input.
  return items.find((a) => oldPicks >= a.range[0] && oldPicks <= a.range[1]) as Archetype;
}
