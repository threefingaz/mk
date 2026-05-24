import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, render, renderHook } from '@testing-library/react';
import { useRef } from 'react';
import { useTilt } from './useTilt';

type MatchMediaMock = (matches: boolean) => (query: string) => MediaQueryList;

const makeMatchMedia: MatchMediaMock = (matches) => (query: string) =>
  ({
    matches,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  }) as unknown as MediaQueryList;

const originalMatchMedia = window.matchMedia;

afterEach(() => {
  window.matchMedia = originalMatchMedia;
  vi.restoreAllMocks();
});

describe('useTilt', () => {
  it('returns a ref that attaches to a mounted element', () => {
    window.matchMedia = makeMatchMedia(false);

    function Probe() {
      const { ref, style } = useTilt();
      // local ref so the test can read the element after mount
      const localRef = useRef<HTMLDivElement | null>(null);
      return (
        <div
          data-testid="tilt-target"
          ref={(node) => {
            // Forward to both refs so the hook attaches AND the test can read it.
            (ref as unknown as { current: HTMLDivElement | null }).current = node;
            localRef.current = node;
          }}
          style={style}
        />
      );
    }

    const { getByTestId } = render(<Probe />);
    const el = getByTestId('tilt-target');
    expect(el).toBeInstanceOf(HTMLElement);
    // Sanity: rendered, in DOM, and the consumer pattern (spread style) doesn't blow up.
    expect(el.isConnected).toBe(true);
  });

  it('returns identity style when prefers-reduced-motion is set', () => {
    window.matchMedia = makeMatchMedia(true);

    const { result } = renderHook(() => useTilt());
    // Mount a real element so the effect can run its bail check.
    const div = document.createElement('div');
    document.body.appendChild(div);
    (result.current.ref as unknown as { current: HTMLElement | null }).current = div;

    // No transform should be applied — style stays identity (empty).
    expect(result.current.style).toEqual({});
    const styleAny = result.current.style as Record<string, unknown>;
    const transform = typeof styleAny.transform === 'string' ? styleAny.transform : '';
    expect(transform).not.toMatch(/rotateX|rotateY/);

    document.body.removeChild(div);
  });

  it('updates the transform on mousemove (rAF-throttled)', () => {
    window.matchMedia = makeMatchMedia(false);

    // Stub rAF to run synchronously so we can observe the next-frame update.
    const rafSpy = vi
      .spyOn(window, 'requestAnimationFrame')
      .mockImplementation((cb: FrameRequestCallback) => {
        cb(0);
        return 1 as unknown as number;
      });
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});

    function Probe() {
      const { ref, style } = useTilt(10);
      return (
        <div
          data-testid="tilt-target"
          ref={ref as unknown as React.RefObject<HTMLDivElement>}
          style={{ width: 200, height: 200, ...style }}
        />
      );
    }

    const { getByTestId } = render(<Probe />);
    const el = getByTestId('tilt-target') as HTMLDivElement;

    // jsdom getBoundingClientRect returns zeros by default; stub a real-looking rect
    // so the cursor offset math has non-zero dimensions to work with.
    el.getBoundingClientRect = () =>
      ({
        x: 0,
        y: 0,
        top: 0,
        left: 0,
        right: 200,
        bottom: 200,
        width: 200,
        height: 200,
        toJSON: () => ({}),
      }) as DOMRect;

    act(() => {
      const ev = new MouseEvent('mousemove', { clientX: 200, clientY: 200, bubbles: true });
      el.dispatchEvent(ev);
    });

    expect(rafSpy).toHaveBeenCalled();
    // After the rAF callback, the element's inline style should carry a transform with rotate.
    const transform = el.style.transform;
    expect(transform).toMatch(/rotateX/);
    expect(transform).toMatch(/rotateY/);
  });

  it('resets transform on mouseleave (rotateX/rotateY return to 0)', () => {
    window.matchMedia = makeMatchMedia(false);

    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb: FrameRequestCallback) => {
      cb(0);
      return 1 as unknown as number;
    });
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});

    function Probe() {
      const { ref, style } = useTilt(10);
      return (
        <div
          data-testid="tilt-target"
          ref={ref as unknown as React.RefObject<HTMLDivElement>}
          style={{ width: 200, height: 200, ...style }}
        />
      );
    }

    const { getByTestId } = render(<Probe />);
    const el = getByTestId('tilt-target') as HTMLDivElement;

    el.getBoundingClientRect = () =>
      ({
        x: 0,
        y: 0,
        top: 0,
        left: 0,
        right: 200,
        bottom: 200,
        width: 200,
        height: 200,
        toJSON: () => ({}),
      }) as DOMRect;

    // Move first so transform is non-zero.
    act(() => {
      el.dispatchEvent(new MouseEvent('mousemove', { clientX: 200, clientY: 200, bubbles: true }));
    });
    expect(el.style.transform).toMatch(/rotate/);

    // Then leave — transform should reset to rotateX(0deg) / rotateY(0deg).
    act(() => {
      el.dispatchEvent(new MouseEvent('mouseleave', { bubbles: true }));
    });
    expect(el.style.transform).toContain('rotateX(0deg)');
    expect(el.style.transform).toContain('rotateY(0deg)');
  });
});
