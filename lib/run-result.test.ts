import { describe, expect, it } from 'vitest';
import { FIGHTERS, type Era, type FighterId } from './fighters';
import { computeRunResult, type CrowdStats } from './run-result';

const RUN_ID = 'test-run-1234';
const SEQUENTIAL_ORDER = [0, 1, 2, 3, 4, 5, 6, 7, 8];
const INJECTED_DATE = '2026.05.23';

describe('computeRunResult', () => {
  describe('n1 mode (pre-unlock)', () => {
    it('returns null defied and null majority on every pick row when unlocked=false', () => {
      const picks: Era[] = Array(9).fill('old');
      const result = computeRunResult({
        picks,
        order: SEQUENTIAL_ORDER,
        crowdStats: null,
        unlocked: false,
        runId: RUN_ID,
        date: INJECTED_DATE,
      });

      expect(result.defied).toBeNull();
      expect(result.picks).toHaveLength(9);
      for (const row of result.picks) {
        expect(row.majority).toBeNull();
      }
      expect(result.oldPicks).toBe(9);
      expect(result.newPicks).toBe(0);
      expect(result.archetype.name).toBe('90s Die-Hard');
      expect(result.runId).toBe(RUN_ID);
      expect(result.date).toBe(INJECTED_DATE);
    });

    it('returns null defied even when crowdStats is non-null but unlocked=false (defensive)', () => {
      const stats: Partial<CrowdStats> = {
        raiden: { old: 10, new: 2, total: 12 },
      };
      const picks: Era[] = Array(9).fill('new');
      const result = computeRunResult({
        picks,
        order: SEQUENTIAL_ORDER,
        crowdStats: stats,
        unlocked: false,
        runId: RUN_ID,
        date: INJECTED_DATE,
      });

      expect(result.defied).toBeNull();
      for (const row of result.picks) {
        expect(row.majority).toBeNull();
      }
    });
  });

  describe('unlocked mode with alternating picks', () => {
    it('counts defied where choice diverges from crowd majority', () => {
      // Picks: old, new, old, new, old, new, old, new, old
      // (5 old + 4 new = oldPicks 5 → Switch-Hitter)
      const picks: Era[] = ['old', 'new', 'old', 'new', 'old', 'new', 'old', 'new', 'old'];

      // FIGHTERS in canonical order are:
      // 0 raiden, 1 liukang, 2 johnnycage, 3 sonya, 4 kitana,
      // 5 shangtsung, 6 kano, 7 scorpion, 8 subzero
      //
      // Construct majorities such that we can hand-count divergences.
      //   raiden  → majority old   (player picked old   → MATCH)
      //   liukang → majority old   (player picked new   → DEFY)
      //   johnnycage → majority new (player picked old → DEFY)
      //   sonya   → majority new   (player picked new   → MATCH)
      //   kitana  → majority old   (player picked old   → MATCH)
      //   shangtsung → majority new (player picked new → MATCH)
      //   kano    → majority old   (player picked old   → MATCH)
      //   scorpion → majority new  (player picked new   → MATCH)
      //   subzero → majority old   (player picked old   → MATCH)
      // Expected defied = 2.
      const stats: Partial<CrowdStats> = {
        raiden: { old: 80, new: 20, total: 100 },
        liukang: { old: 60, new: 40, total: 100 },
        johnnycage: { old: 30, new: 70, total: 100 },
        sonya: { old: 25, new: 75, total: 100 },
        kitana: { old: 55, new: 45, total: 100 },
        shangtsung: { old: 10, new: 90, total: 100 },
        kano: { old: 95, new: 5, total: 100 },
        scorpion: { old: 5, new: 95, total: 100 },
        subzero: { old: 90, new: 10, total: 100 },
      };

      const result = computeRunResult({
        picks,
        order: SEQUENTIAL_ORDER,
        crowdStats: stats,
        unlocked: true,
        runId: RUN_ID,
        date: INJECTED_DATE,
      });

      expect(result.oldPicks).toBe(5);
      expect(result.newPicks).toBe(4);
      expect(result.archetype.name).toBe('Switch-Hitter');
      expect(result.defied).toBe(2);

      // Per-row sanity: majority is set on every row, and the two defied rows
      // are exactly liukang (index 1) and johnnycage (index 2).
      for (const row of result.picks) {
        expect(row.majority).not.toBeNull();
      }
      expect(result.picks[1].fighter).toBe('liukang');
      expect(result.picks[1].choice).toBe('new');
      expect(result.picks[1].majority).toBe('old');
      expect(result.picks[2].fighter).toBe('johnnycage');
      expect(result.picks[2].choice).toBe('old');
      expect(result.picks[2].majority).toBe('new');
    });

    it('rows expose the fighter id at the corresponding shuffled position', () => {
      const reversedOrder = [8, 7, 6, 5, 4, 3, 2, 1, 0];
      const picks: Era[] = Array(9).fill('old');
      const result = computeRunResult({
        picks,
        order: reversedOrder,
        crowdStats: {},
        unlocked: true,
        runId: RUN_ID,
        date: INJECTED_DATE,
      });

      for (let i = 0; i < 9; i++) {
        expect(result.picks[i].fighter).toBe(FIGHTERS[reversedOrder[i]].id);
      }
    });
  });

  describe('unlocked=true with crowdStats=null short-circuit', () => {
    it('returns null defied + null majority on every row when unlocked is true but crowdStats is null', () => {
      // Edge case: the unlock flag is true but the fetch failed or hadn't
      // yet populated stats. computeRunResult should treat this as "no data"
      // (defied null, majority null on every row) rather than asserting on
      // every fighter lookup.
      const picks: Era[] = Array(9).fill('old');
      const result = computeRunResult({
        picks,
        order: SEQUENTIAL_ORDER,
        crowdStats: null,
        unlocked: true,
        runId: RUN_ID,
        date: INJECTED_DATE,
      });

      expect(result.defied).toBeNull();
      for (const row of result.picks) {
        expect(row.majority).toBeNull();
      }
    });
  });

  describe('unlocked but missing fighters from stats', () => {
    it('rows for missing fighters get majority=null and are skipped in defied count', () => {
      // Only 5 fighters have crowd data; the other 4 are missing.
      const stats: Partial<CrowdStats> = {
        raiden: { old: 100, new: 0, total: 100 },   // majority old
        liukang: { old: 0, new: 100, total: 100 },  // majority new
        johnnycage: { old: 60, new: 40, total: 100 }, // majority old
        sonya: { old: 20, new: 80, total: 100 },    // majority new
        kitana: { old: 51, new: 49, total: 100 },   // majority old
        // shangtsung, kano, scorpion, subzero absent
      };

      // Picks (in canonical order):
      //   raiden     'new' → DEFY (majority old)
      //   liukang    'old' → DEFY (majority new)
      //   johnnycage 'old' → match
      //   sonya      'new' → match
      //   kitana     'new' → DEFY (majority old)
      //   shangtsung 'old' → SKIP (no data)
      //   kano       'old' → SKIP
      //   scorpion   'new' → SKIP
      //   subzero    'old' → SKIP
      // Expected defied = 3.
      const picks: Era[] = ['new', 'old', 'old', 'new', 'new', 'old', 'old', 'new', 'old'];

      const result = computeRunResult({
        picks,
        order: SEQUENTIAL_ORDER,
        crowdStats: stats,
        unlocked: true,
        runId: RUN_ID,
        date: INJECTED_DATE,
      });

      expect(result.defied).toBe(3);
      // Rows 5..8 (shangtsung, kano, scorpion, subzero) must have null majority.
      const knownFighters: FighterId[] = ['raiden', 'liukang', 'johnnycage', 'sonya', 'kitana'];
      for (let i = 0; i < 9; i++) {
        const row = result.picks[i];
        if (knownFighters.includes(row.fighter)) {
          expect(row.majority).not.toBeNull();
        } else {
          expect(row.majority).toBeNull();
        }
      }
    });

    it('treats fighters with zero total votes as no-data (majority null, not tiebreaker)', () => {
      const stats: Partial<CrowdStats> = {
        raiden: { old: 0, new: 0, total: 0 },
      };
      const picks: Era[] = Array(9).fill('old');
      const result = computeRunResult({
        picks,
        order: SEQUENTIAL_ORDER,
        crowdStats: stats,
        unlocked: true,
        runId: RUN_ID,
        date: INJECTED_DATE,
      });

      expect(result.picks[0].fighter).toBe('raiden');
      expect(result.picks[0].majority).toBeNull();
      // None of the other fighters have data either; defied is 0 (not null —
      // we're in unlocked mode with non-null crowdStats; just no contributions).
      expect(result.defied).toBe(0);
    });
  });

  describe('archetype embedding', () => {
    it('returned archetype.name matches archetypeFor(oldPicks).name across the range', () => {
      const cases: Array<[Era[], string]> = [
        [Array(9).fill('old') as Era[], '90s Die-Hard'],
        [['old', 'old', 'old', 'old', 'old', 'old', 'new', 'new', 'new'], 'Old-School'],
        [['old', 'old', 'old', 'old', 'old', 'new', 'new', 'new', 'new'], 'Switch-Hitter'],
        [['old', 'old', 'old', 'new', 'new', 'new', 'new', 'new', 'new'], 'New-School'],
        [Array(9).fill('new') as Era[], 'New Blood'],
      ];
      for (const [picks, expectedName] of cases) {
        const result = computeRunResult({
          picks,
          order: SEQUENTIAL_ORDER,
          crowdStats: null,
          unlocked: false,
          runId: RUN_ID,
          date: INJECTED_DATE,
        });
        expect(result.archetype.name).toBe(expectedName);
      }
    });
  });

  describe('date handling', () => {
    it('uses the injected date string verbatim when provided', () => {
      const result = computeRunResult({
        picks: Array(9).fill('old') as Era[],
        order: SEQUENTIAL_ORDER,
        crowdStats: null,
        unlocked: false,
        runId: RUN_ID,
        date: '2026.05.23',
      });
      expect(result.date).toBe('2026.05.23');
    });
  });

  describe('input validation', () => {
    it('throws when picks length is not 9', () => {
      expect(() =>
        computeRunResult({
          picks: ['old', 'new'],
          order: SEQUENTIAL_ORDER,
          crowdStats: null,
          unlocked: false,
          runId: RUN_ID,
          date: INJECTED_DATE,
        }),
      ).toThrow(RangeError);
    });

    it('throws when order length is not 9', () => {
      expect(() =>
        computeRunResult({
          picks: Array(9).fill('old') as Era[],
          order: [0, 1, 2],
          crowdStats: null,
          unlocked: false,
          runId: RUN_ID,
          date: INJECTED_DATE,
        }),
      ).toThrow(RangeError);
    });
  });
});
