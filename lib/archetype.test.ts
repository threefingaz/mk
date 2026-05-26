import { describe, expect, it } from 'vitest';
import { ARCHETYPE_SETS, archetypeFor } from './archetype';

describe('archetypeFor', () => {
  describe('range mapping', () => {
    it('0 and 1 → "New Blood"', () => {
      expect(archetypeFor(0).name).toBe('New Blood');
      expect(archetypeFor(1).name).toBe('New Blood');
    });

    it('2 and 3 → "New Convert"', () => {
      expect(archetypeFor(2).name).toBe('New Convert');
      expect(archetypeFor(3).name).toBe('New Convert');
    });

    it('4 and 5 → "Switch-Hitter"', () => {
      expect(archetypeFor(4).name).toBe('Switch-Hitter');
      expect(archetypeFor(5).name).toBe('Switch-Hitter');
    });

    it('6 and 7 → "Old Guard"', () => {
      expect(archetypeFor(6).name).toBe('Old Guard');
      expect(archetypeFor(7).name).toBe('Old Guard');
    });

    it('8 and 9 → "90s Die-Hard"', () => {
      expect(archetypeFor(8).name).toBe('90s Die-Hard');
      expect(archetypeFor(9).name).toBe('90s Die-Hard');
    });
  });

  describe('returns full archetype shape', () => {
    it('includes range, name, lean on every match', () => {
      for (let i = 0; i <= 9; i++) {
        const a = archetypeFor(i);
        expect(a).toEqual(
          expect.objectContaining({
            range: expect.any(Array),
            name: expect.any(String),
            lean: expect.stringMatching(/^(old|split|new)$/),
          }),
        );
        expect(a.range).toHaveLength(2);
        expect(i).toBeGreaterThanOrEqual(a.range[0]);
        expect(i).toBeLessThanOrEqual(a.range[1]);
      }
    });

    it('uses set A by default and matches ARCHETYPE_SETS.A items', () => {
      // archetypeFor(5) should map to the Switch-Hitter entry verbatim.
      const a = archetypeFor(5);
      expect(a).toBe(ARCHETYPE_SETS.A.items.find((x) => x.name === 'Switch-Hitter'));
    });

    it('lean assignment matches plan spec', () => {
      expect(archetypeFor(0).lean).toBe('new');
      expect(archetypeFor(2).lean).toBe('new');
      expect(archetypeFor(4).lean).toBe('split');
      expect(archetypeFor(6).lean).toBe('old');
      expect(archetypeFor(8).lean).toBe('old');
    });
  });

  describe('out-of-range rejection', () => {
    it('throws for negative values', () => {
      expect(() => archetypeFor(-1)).toThrow(RangeError);
    });

    it('throws for values > 9', () => {
      expect(() => archetypeFor(10)).toThrow(RangeError);
      expect(() => archetypeFor(100)).toThrow(RangeError);
    });
  });
});
