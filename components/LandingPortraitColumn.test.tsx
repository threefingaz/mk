import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { LandingPortraitColumn } from './LandingPortraitColumn';
import { FIGHTERS } from '@/lib/fighters';

// Per CLAUDE.md ("Don't unit-test visual components") this file is trimmed
// to the three load-bearing invariants of LandingPortraitColumn:
//
//   1. The track contains exactly `2 × FIGHTERS.length` slots. The CSS
//      animation drifts the track by `translateY(-50%)` — any other count
//      would produce a visible jump at the loop boundary. This is the one
//      thing a future refactor could silently break.
//   2. `data-dir` reflects the `direction` prop. The CSS marquee keys on
//      this attribute to pick scroll direction; a regression that swallowed
//      the prop would freeze the marquee in one direction.
//   3. The `era` prop is forwarded to every <Portrait> (verified via the
//      rendered <img alt> containing `(<era>)`). Without this, a regression
//      that hardcoded `era="old"` inside the column would silently violate
//      the era-skin invariant.

describe('LandingPortraitColumn', () => {
  it('renders exactly 2× FIGHTERS portrait slots (seamless-loop invariant)', () => {
    const { container } = render(
      <LandingPortraitColumn era="old" direction="down" />,
    );
    const slots = container.querySelectorAll('.landing-portrait-slot');
    expect(slots.length).toBe(FIGHTERS.length * 2);
  });

  it.each([['down'], ['up']] as const)(
    'sets data-dir="%s" on the track when direction matches',
    (direction) => {
      const { container } = render(
        <LandingPortraitColumn era="old" direction={direction} />,
      );
      const track = container.querySelector('.landing-portrait-track');
      expect(track).not.toBeNull();
      expect(track!.getAttribute('data-dir')).toBe(direction);
    },
  );

  it.each([['old'], ['new']] as const)(
    'forwards era="%s" to every Portrait (era-skin invariant)',
    (era) => {
      const { container } = render(
        <LandingPortraitColumn era={era} direction="down" />,
      );
      const imgs = container.querySelectorAll('img');
      expect(imgs.length).toBe(FIGHTERS.length * 2);
      imgs.forEach((img) => {
        expect(img.getAttribute('alt')).toContain(`(${era})`);
      });
    },
  );
});
