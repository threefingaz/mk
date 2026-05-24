import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { BrandMark } from './BrandMark';

// BrandMark accepts `size: number | string`. The string path was widened to
// support `clamp(...)` expressions for the desktop layout. A future arithmetic
// refactor (e.g. `size * 0.5`) would silently produce `NaN` from a string —
// this test pins the string contract so the regression surfaces in CI.

describe('BrandMark', () => {
  it('renders a numeric `size` as `fontSize: ${n}px`', () => {
    const { container } = render(<BrandMark size={18} />);
    const root = container.querySelector('.brand-mark') as HTMLElement | null;
    expect(root).not.toBeNull();
    // jsdom serializes numeric `fontSize` from React as `18px`.
    expect(root!.style.fontSize).toBe('18px');
  });

  it('passes a `clamp()` string through to `fontSize` unchanged', () => {
    const value = 'clamp(28px, 4vw, 48px)';
    const { container } = render(<BrandMark size={value} />);
    const root = container.querySelector('.brand-mark') as HTMLElement | null;
    expect(root).not.toBeNull();
    expect(root!.style.fontSize).toBe(value);
  });

  it('applies the same `fontSize` in vertical mode', () => {
    const value = 'clamp(14px, 1.6vw, 18px)';
    const { container } = render(<BrandMark size={value} vertical />);
    const root = container.querySelector('.brand-mark') as HTMLElement | null;
    expect(root).not.toBeNull();
    expect(root!.style.fontSize).toBe(value);
  });
});
