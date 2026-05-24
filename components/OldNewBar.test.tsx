import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { OldNewBar } from './OldNewBar';

// The component computes oldPct = (oldPicks / (oldPicks + newPicks || 1)) * 100.
// For the canonical 9-pick run (oldPicks + newPicks === 9), this is identical
// to the prototype's hardcoded /9 denominator. Tests assert the exact inline
// width strings that the component generates.

describe('OldNewBar', () => {
  describe('percentage math at boundary cases', () => {
    it('renders 0% old / 100% new when oldPicks=0, newPicks=9', () => {
      render(<OldNewBar oldPicks={0} newPicks={9} />);
      const oldHalf = screen.getByTestId('old-new-bar-old');
      const newHalf = screen.getByTestId('old-new-bar-new');
      expect(oldHalf.style.width).toBe('0%');
      expect(newHalf.style.width).toBe('100%');
    });

    it('renders 100% old / 0% new when oldPicks=9, newPicks=0', () => {
      render(<OldNewBar oldPicks={9} newPicks={0} />);
      const oldHalf = screen.getByTestId('old-new-bar-old');
      const newHalf = screen.getByTestId('old-new-bar-new');
      expect(oldHalf.style.width).toBe('100%');
      expect(newHalf.style.width).toBe('0%');
    });

    it('renders (5/9)*100 % old / remainder % new when oldPicks=5, newPicks=4', () => {
      render(<OldNewBar oldPicks={5} newPicks={4} />);
      const oldHalf = screen.getByTestId('old-new-bar-old');
      const newHalf = screen.getByTestId('old-new-bar-new');
      const expectedOldPct = (5 / 9) * 100;
      const expectedNewPct = 100 - expectedOldPct;
      expect(oldHalf.style.width).toBe(`${expectedOldPct}%`);
      expect(newHalf.style.width).toBe(`${expectedNewPct}%`);
    });
  });

  describe('count labels', () => {
    it('renders OLD · N in the old half', () => {
      render(<OldNewBar oldPicks={5} newPicks={4} />);
      const oldHalf = screen.getByTestId('old-new-bar-old');
      expect(oldHalf).toHaveTextContent('OLD · 5');
    });

    it('renders NEW · N in the new half', () => {
      render(<OldNewBar oldPicks={5} newPicks={4} />);
      const newHalf = screen.getByTestId('old-new-bar-new');
      expect(newHalf).toHaveTextContent('NEW · 4');
    });

    it('keeps OLD · N out of the new half (and vice versa)', () => {
      render(<OldNewBar oldPicks={5} newPicks={4} />);
      const oldHalf = screen.getByTestId('old-new-bar-old');
      const newHalf = screen.getByTestId('old-new-bar-new');
      expect(oldHalf).not.toHaveTextContent('NEW');
      expect(newHalf).not.toHaveTextContent('OLD');
    });
  });

  describe('total=0 edge case', () => {
    it('renders a symmetric 50/50 split (zero-state must not lie visually)', () => {
      render(<OldNewBar oldPicks={0} newPicks={0} />);
      const oldHalf = screen.getByTestId('old-new-bar-old');
      const newHalf = screen.getByTestId('old-new-bar-new');
      // 50/50 split — neither era dominates a true zero-state.
      expect(oldHalf.style.width).toBe('50%');
      expect(newHalf.style.width).toBe('50%');
      // No NaN in the rendered width strings.
      expect(oldHalf.style.width).not.toContain('NaN');
      expect(newHalf.style.width).not.toContain('NaN');
      // Both labels still render with the zero counts.
      expect(oldHalf).toHaveTextContent('OLD · 0');
      expect(newHalf).toHaveTextContent('NEW · 0');
    });
  });
});
