import { describe, expect, it } from 'vitest';
import { FIGHTERS, type Era, type FighterId } from './fighters';
import { portraitFor } from './portraits';

const ERAS: Era[] = ['old', 'new'];

describe('portraitFor', () => {
  it('returns the canonical path for all 18 valid (fighter × era) combinations', () => {
    const combos: Array<[FighterId, Era, string]> = [];
    for (const fighter of FIGHTERS) {
      for (const era of ERAS) {
        combos.push([fighter.id, era, `/portraits/${fighter.id}-${era}.jpg`]);
      }
    }
    expect(combos).toHaveLength(18);
    for (const [id, era, expected] of combos) {
      expect(portraitFor(id, era)).toBe(expected);
    }
  });
});
