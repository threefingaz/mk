import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { UnlockMoment } from './UnlockMoment';

// Scoped per CLAUDE.md's "pragmatic testing posture":
//   - Visual layout is NOT tested.
//   - Behavior + load-bearing contracts ARE tested.
//
// The `unlock-celebration` class on the root is load-bearing because the
// reduced-motion guard in `app/globals.css` selects on it
// (`.unlock-celebration *`). If a future refactor renames or drops the
// class, the celebratory `reveal-up` / `glitch-x` / `pulse-red` animations
// stop being suppressed under `prefers-reduced-motion: reduce`.
//
// This test anchors that contract so a rename triggers a test failure
// instead of silently breaking accessibility.

describe('UnlockMoment', () => {
  it('keeps the load-bearing `unlock-celebration` class on the root', () => {
    render(<UnlockMoment plays={42} />);
    const root = screen.getByTestId('unlock-moment-screen');
    expect(root).toHaveClass('unlock-celebration');
  });
});
