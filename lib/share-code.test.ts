import { describe, expect, it } from 'vitest';
import {
  buildCanonicalPicks,
  decodeShareCode,
  encodeShareCode,
  SHARE_CODE_LENGTH,
} from './share-code';
import type { Era } from './fighters';

const allOld: Era[] = Array(9).fill('old');
const allNew: Era[] = Array(9).fill('new');
const alternating: Era[] = ['old', 'new', 'old', 'new', 'old', 'new', 'old', 'new', 'old'];
// 5 olds + 4 news — matches the "real" sample shape from the Task 19 e2e
// (alternating picks pattern with 5 olds in odd indices).
const realSample: Era[] = ['old', 'new', 'new', 'old', 'old', 'new', 'old', 'new', 'old'];

describe('encodeShareCode', () => {
  it('emits a 3-char base64url string', () => {
    expect(encodeShareCode(allOld)).toHaveLength(SHARE_CODE_LENGTH);
    expect(encodeShareCode(allNew)).toHaveLength(SHARE_CODE_LENGTH);
    expect(encodeShareCode(alternating)).toHaveLength(SHARE_CODE_LENGTH);
    expect(encodeShareCode(realSample)).toHaveLength(SHARE_CODE_LENGTH);
  });

  it('emits only base64url-safe characters (no `+`, `/`, or `=`)', () => {
    // Iterate every distinct 9-pick combination (2^9 = 512) and assert charset.
    for (let mask = 0; mask < 512; mask++) {
      const picks: Era[] = [];
      for (let i = 0; i < 9; i++) {
        picks.push((mask >> i) & 1 ? 'old' : 'new');
      }
      const code = encodeShareCode(picks);
      expect(code).toMatch(/^[A-Za-z0-9\-_]{3}$/);
    }
  });

  it('produces distinct codes for distinct pick patterns', () => {
    const codes = new Set<string>();
    for (let mask = 0; mask < 512; mask++) {
      const picks: Era[] = [];
      for (let i = 0; i < 9; i++) {
        picks.push((mask >> i) & 1 ? 'old' : 'new');
      }
      codes.add(encodeShareCode(picks));
    }
    expect(codes.size).toBe(512);
  });

  describe('malformed input', () => {
    it('throws when picks is not an array', () => {
      // @ts-expect-error — runtime guard
      expect(() => encodeShareCode('old' as unknown)).toThrow(Error);
      // @ts-expect-error — runtime guard
      expect(() => encodeShareCode(null)).toThrow(Error);
      // @ts-expect-error — runtime guard
      expect(() => encodeShareCode(undefined)).toThrow(Error);
    });

    it('throws when picks.length !== 9', () => {
      expect(() => encodeShareCode([])).toThrow(Error);
      expect(() => encodeShareCode(Array(8).fill('old') as Era[])).toThrow(Error);
      expect(() => encodeShareCode(Array(10).fill('old') as Era[])).toThrow(Error);
    });

    it("throws when any entry isn't 'old' or 'new'", () => {
      const bad: Era[] = [...allOld];
      // @ts-expect-error — runtime guard
      bad[0] = 'middle';
      expect(() => encodeShareCode(bad)).toThrow(Error);

      const bad2: Era[] = [...allOld];
      // @ts-expect-error — runtime guard
      bad2[5] = '';
      expect(() => encodeShareCode(bad2)).toThrow(Error);

      const bad3: Era[] = [...allOld];
      // @ts-expect-error — runtime guard
      bad3[8] = null;
      expect(() => encodeShareCode(bad3)).toThrow(Error);
    });
  });
});

describe('decodeShareCode', () => {
  describe('round trip', () => {
    it('all-old → 9 olds', () => {
      const picks = decodeShareCode(encodeShareCode(allOld));
      expect(picks).toEqual(allOld);
    });

    it('all-new → 9 news', () => {
      const picks = decodeShareCode(encodeShareCode(allNew));
      expect(picks).toEqual(allNew);
    });

    it('alternating → preserves order', () => {
      const picks = decodeShareCode(encodeShareCode(alternating));
      expect(picks).toEqual(alternating);
    });

    it('real sample (5 olds + 4 news) → preserves order', () => {
      const picks = decodeShareCode(encodeShareCode(realSample));
      expect(picks).toEqual(realSample);
    });

    it('round-trips every one of the 512 possible pick patterns', () => {
      for (let mask = 0; mask < 512; mask++) {
        const picks: Era[] = [];
        for (let i = 0; i < 9; i++) {
          picks.push((mask >> i) & 1 ? 'old' : 'new');
        }
        const decoded = decodeShareCode(encodeShareCode(picks));
        expect(decoded).toEqual(picks);
      }
    });
  });

  describe('malformed input', () => {
    it('throws on non-string input', () => {
      // @ts-expect-error — runtime guard
      expect(() => decodeShareCode(null)).toThrow(Error);
      // @ts-expect-error — runtime guard
      expect(() => decodeShareCode(undefined)).toThrow(Error);
      // @ts-expect-error — runtime guard
      expect(() => decodeShareCode(42)).toThrow(Error);
    });

    it('throws on empty string', () => {
      expect(() => decodeShareCode('')).toThrow(Error);
    });

    it('throws on wrong length (1 char — too short)', () => {
      expect(() => decodeShareCode('A')).toThrow(Error);
    });

    it('throws on wrong length (2 chars — too short)', () => {
      expect(() => decodeShareCode('AB')).toThrow(Error);
    });

    it('throws on wrong length (4+ chars — too long)', () => {
      expect(() => decodeShareCode('AAAA')).toThrow(Error);
      expect(() => decodeShareCode('AAAAA')).toThrow(Error);
      expect(() => decodeShareCode('AAAAAAAA')).toThrow(Error);
    });

    it('throws on invalid base64url characters', () => {
      // `+` and `/` aren't part of the URL-safe alphabet; `=` would be padding.
      expect(() => decodeShareCode('A+A')).toThrow(Error);
      expect(() => decodeShareCode('A/A')).toThrow(Error);
      expect(() => decodeShareCode('A=A')).toThrow(Error);
      expect(() => decodeShareCode('!!!')).toThrow(Error);
      // Whitespace also rejected.
      expect(() => decodeShareCode('A A')).toThrow(Error);
    });
  });
});

// ---------------------------------------------------------------------------
// buildCanonicalPicks — the inversion that caused the original CRITICAL bug.
// ---------------------------------------------------------------------------

describe('buildCanonicalPicks', () => {
  it('identity order returns picks unchanged', () => {
    const order = [0, 1, 2, 3, 4, 5, 6, 7, 8];
    expect(buildCanonicalPicks(realSample, order)).toEqual(realSample);
  });

  it('non-trivial shuffle inverts the mapping correctly', () => {
    // Session order [3, 1, 8, 0, 5, 4, 2, 7, 6] means:
    //   picks[0] applies to FIGHTERS[3]
    //   picks[1] applies to FIGHTERS[1]
    //   picks[2] applies to FIGHTERS[8]
    //   ...
    // So canonical[3] = picks[0], canonical[1] = picks[1], canonical[8] = picks[2], etc.
    const order = [3, 1, 8, 0, 5, 4, 2, 7, 6];
    const picks: Era[] = ['old', 'new', 'old', 'new', 'new', 'old', 'new', 'old', 'new'];
    const canonical = buildCanonicalPicks(picks, order);
    // Verify position-by-position so the inversion is unambiguous.
    expect(canonical[3]).toBe('old'); // picks[0]
    expect(canonical[1]).toBe('new'); // picks[1]
    expect(canonical[8]).toBe('old'); // picks[2]
    expect(canonical[0]).toBe('new'); // picks[3]
    expect(canonical[5]).toBe('new'); // picks[4]
    expect(canonical[4]).toBe('old'); // picks[5]
    expect(canonical[2]).toBe('new'); // picks[6]
    expect(canonical[7]).toBe('old'); // picks[7]
    expect(canonical[6]).toBe('new'); // picks[8]
  });

  it('encode→decode against the inverted-shuffle round-trips to the canonical view', () => {
    // Player sees fighters in shuffled order [2, 0, 1, ...] but the share code
    // must encode the picks indexed against canonical FIGHTERS[i].
    const order = [3, 1, 8, 0, 5, 4, 2, 7, 6];
    const sessionPicks: Era[] = ['old', 'new', 'old', 'new', 'new', 'old', 'new', 'old', 'new'];
    const canonical = buildCanonicalPicks(sessionPicks, order);
    const code = encodeShareCode(canonical);
    const decoded = decodeShareCode(code);
    expect(decoded).toEqual(canonical);
  });

  it('throws when picks and order have different lengths', () => {
    expect(() => buildCanonicalPicks([], [0, 1])).toThrow(Error);
    expect(() => buildCanonicalPicks(['old', 'new'], [0])).toThrow(Error);
  });
});
