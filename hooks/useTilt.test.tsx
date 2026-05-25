import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, render } from '@testing-library/react';
import { useTilt } from './useTilt';

/**
 * Build a matchMedia mock with per-query control. Defaults model a hover-capable
 * desktop without reduced-motion: `(prefers-reduced-motion: reduce)` → false,
 * `(hover: hover) and (pointer: fine)` → true. Pass `reducedMotion: true` to
 * simulate the OS setting, or `canHover: false` to simulate a touch device.
 * The single-boolean form is preserved for back-compat: `makeMatchMedia(true)`
 * still means "reduced-motion on" (and leaves hover capable).
 */
type MatchMediaOpts = { reducedMotion?: boolean; canHover?: boolean };
type MatchMediaMock = (opts?: boolean | MatchMediaOpts) => (query: string) => MediaQueryList;

const makeMatchMedia: MatchMediaMock = (opts) => {
  const reducedMotion = typeof opts === 'boolean' ? opts : (opts?.reducedMotion ?? false);
  const canHover = typeof opts === 'boolean' ? true : (opts?.canHover ?? true);
  return (query: string) => {
    let matches = false;
    if (query.includes('prefers-reduced-motion: reduce')) matches = reducedMotion;
    else if (query.includes('hover: hover') || query.includes('pointer: fine')) matches = canHover;
    return {
      matches,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    } as unknown as MediaQueryList;
  };
};

const originalMatchMedia = window.matchMedia;

afterEach(() => {
  window.matchMedia = originalMatchMedia;
  vi.restoreAllMocks();
});

/**
 * Install a rAF stub that records callbacks instead of running them.
 * Returns a `flush(n)` helper that drains up to `n` queued frames.
 * Each frame may schedule the next frame, so the queue must be re-checked.
 */
function installRafStub() {
  const queue: FrameRequestCallback[] = [];
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb: FrameRequestCallback) => {
    queue.push(cb);
    return queue.length;
  });
  vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});

  return {
    flush(maxFrames: number) {
      for (let i = 0; i < maxFrames; i++) {
        const cb = queue.shift();
        if (!cb) return i;
        cb(performance.now());
      }
      return maxFrames;
    },
    pending() {
      return queue.length;
    },
  };
}

function makeRect(): DOMRect {
  return {
    x: 0,
    y: 0,
    top: 0,
    left: 0,
    right: 200,
    bottom: 200,
    width: 200,
    height: 200,
    toJSON: () => ({}),
  } as DOMRect;
}

describe('useTilt', () => {
  it('attaches the ref to a mounted element and writes CSS vars on mousemove', () => {
    window.matchMedia = makeMatchMedia(false);
    const raf = installRafStub();

    function Probe() {
      const { ref } = useTilt<HTMLDivElement>();
      return <div data-testid="tilt-target" ref={ref} style={{ width: 200, height: 200 }} />;
    }

    const { getByTestId } = render(<Probe />);
    const el = getByTestId('tilt-target') as HTMLDivElement;
    el.getBoundingClientRect = () => makeRect();
    expect(el.isConnected).toBe(true);

    act(() => {
      el.dispatchEvent(new MouseEvent('mousemove', { clientX: 200, clientY: 200, bubbles: true }));
    });
    raf.flush(200);

    // Hook wrote the three custom properties — proves the ref is attached
    // AND the listener path is wired end-to-end.
    expect(el.style.getPropertyValue('--rx')).not.toBe('');
    expect(el.style.getPropertyValue('--ry')).not.toBe('');
    expect(el.style.getPropertyValue('--tilt-scale')).not.toBe('');
  });

  it('does not write CSS vars when prefers-reduced-motion is set', () => {
    window.matchMedia = makeMatchMedia(true);
    installRafStub();

    function Probe() {
      const { ref } = useTilt<HTMLDivElement>();
      return <div data-testid="tilt-target" ref={ref} style={{ width: 200, height: 200 }} />;
    }

    const { getByTestId } = render(<Probe />);
    const el = getByTestId('tilt-target') as HTMLDivElement;
    el.getBoundingClientRect = () => makeRect();

    // Dispatch a mousemove — even though listeners are bailed, this proves
    // the bail short-circuits the listener-attach path, not just the early
    // identity-style return.
    act(() => {
      el.dispatchEvent(new MouseEvent('mousemove', { clientX: 200, clientY: 200, bubbles: true }));
    });

    expect(el.style.getPropertyValue('--rx')).toBe('');
    expect(el.style.getPropertyValue('--ry')).toBe('');
    expect(el.style.getPropertyValue('--tilt-scale')).toBe('');
  });

  it('does not write CSS vars when the device is not hover-capable (touch / coarse pointer)', () => {
    // Touch browsers (mobile Safari, Chrome on touch laptops) synthesize
    // mouseenter/mousemove after a tap — without this bail, a tap would
    // leave the card stuck in a rotated/scaled state. Mirrors the matching
    // `@media (hover: hover) and (pointer: fine)` gate around the era-aware
    // hover shadow rules in `app/globals.css`.
    window.matchMedia = makeMatchMedia({ canHover: false });
    installRafStub();

    function Probe() {
      const { ref } = useTilt<HTMLDivElement>();
      return <div data-testid="tilt-target" ref={ref} style={{ width: 200, height: 200 }} />;
    }

    const { getByTestId } = render(<Probe />);
    const el = getByTestId('tilt-target') as HTMLDivElement;
    el.getBoundingClientRect = () => makeRect();

    act(() => {
      el.dispatchEvent(new MouseEvent('mousemove', { clientX: 200, clientY: 200, bubbles: true }));
      el.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
    });

    expect(el.style.getPropertyValue('--rx')).toBe('');
    expect(el.style.getPropertyValue('--ry')).toBe('');
    expect(el.style.getPropertyValue('--tilt-scale')).toBe('');
  });

  it('writes --rx / --ry / --tilt-scale on mousemove and converges to target after enough frames', () => {
    window.matchMedia = makeMatchMedia(false);
    const raf = installRafStub();

    function Probe() {
      const { ref } = useTilt<HTMLDivElement>(10);
      return <div data-testid="tilt-target" ref={ref} style={{ width: 200, height: 200 }} />;
    }

    const { getByTestId } = render(<Probe />);
    const el = getByTestId('tilt-target') as HTMLDivElement;
    el.getBoundingClientRect = () => makeRect();

    // Cursor at the bottom-right corner — target rotation is rx=-5, ry=5 (intensity 10 * (0.5, -0.5))
    act(() => {
      el.dispatchEvent(new MouseEvent('mousemove', { clientX: 200, clientY: 200, bubbles: true }));
    });

    // Drain enough frames for the spring to settle.
    raf.flush(200);

    const rx = parseFloat(el.style.getPropertyValue('--rx'));
    const ry = parseFloat(el.style.getPropertyValue('--ry'));
    const scale = parseFloat(el.style.getPropertyValue('--tilt-scale'));
    expect(rx).toBeCloseTo(-5, 2);
    expect(ry).toBeCloseTo(5, 2);
    expect(scale).toBeCloseTo(1.03, 2);
    // Loop must self-terminate when settled — no queued frames remain.
    expect(raf.pending()).toBe(0);
  });

  it('returns toward identity on mouseleave and settles within a bounded number of frames', () => {
    window.matchMedia = makeMatchMedia(false);
    const raf = installRafStub();

    function Probe() {
      const { ref } = useTilt<HTMLDivElement>(10);
      return <div data-testid="tilt-target" ref={ref} style={{ width: 200, height: 200 }} />;
    }

    const { getByTestId } = render(<Probe />);
    const el = getByTestId('tilt-target') as HTMLDivElement;
    el.getBoundingClientRect = () => makeRect();

    act(() => {
      el.dispatchEvent(new MouseEvent('mousemove', { clientX: 200, clientY: 200, bubbles: true }));
    });
    raf.flush(200);
    expect(parseFloat(el.style.getPropertyValue('--tilt-scale'))).toBeCloseTo(1.03, 2);

    act(() => {
      el.dispatchEvent(new MouseEvent('mouseleave', { bubbles: true }));
    });
    raf.flush(200);

    expect(parseFloat(el.style.getPropertyValue('--rx'))).toBeCloseTo(0, 2);
    expect(parseFloat(el.style.getPropertyValue('--ry'))).toBeCloseTo(0, 2);
    expect(parseFloat(el.style.getPropertyValue('--tilt-scale'))).toBeCloseTo(1, 2);
    // The loop self-terminates — once settled, no further frames should be queued.
    expect(raf.pending()).toBe(0);
  });

  it('back-compat: positional intensity matches options-object intensity', () => {
    window.matchMedia = makeMatchMedia(false);
    const raf = installRafStub();

    function Probe({ asObject }: { asObject: boolean }) {
      const { ref } = useTilt<HTMLDivElement>(asObject ? { intensity: 8 } : 8);
      return (
        <div
          data-testid={asObject ? 'obj' : 'num'}
          ref={ref}
          style={{ width: 200, height: 200 }}
        />
      );
    }

    const { getByTestId, unmount } = render(<Probe asObject={false} />);
    const numEl = getByTestId('num') as HTMLDivElement;
    numEl.getBoundingClientRect = () => makeRect();
    act(() => {
      numEl.dispatchEvent(new MouseEvent('mousemove', { clientX: 200, clientY: 200, bubbles: true }));
    });
    raf.flush(200);
    const numRx = parseFloat(numEl.style.getPropertyValue('--rx'));
    const numRy = parseFloat(numEl.style.getPropertyValue('--ry'));
    expect(raf.pending()).toBe(0);
    unmount();

    const { getByTestId: getByTestId2 } = render(<Probe asObject={true} />);
    const objEl = getByTestId2('obj') as HTMLDivElement;
    objEl.getBoundingClientRect = () => makeRect();
    act(() => {
      objEl.dispatchEvent(new MouseEvent('mousemove', { clientX: 200, clientY: 200, bubbles: true }));
    });
    raf.flush(200);
    const objRx = parseFloat(objEl.style.getPropertyValue('--rx'));
    const objRy = parseFloat(objEl.style.getPropertyValue('--ry'));
    expect(raf.pending()).toBe(0);

    expect(objRx).toBeCloseTo(numRx, 3);
    expect(objRy).toBeCloseTo(numRy, 3);
    // Intensity 8 with cursor at bottom-right corner → rx=-4, ry=4
    expect(numRx).toBeCloseTo(-4, 2);
    expect(numRy).toBeCloseTo(4, 2);
  });

  it('hoverScale option controls the --tilt-scale target', () => {
    window.matchMedia = makeMatchMedia(false);
    const raf = installRafStub();

    function Probe() {
      const { ref } = useTilt<HTMLDivElement>({ intensity: 10, hoverScale: 1.1 });
      return <div data-testid="tilt-target" ref={ref} style={{ width: 200, height: 200 }} />;
    }

    const { getByTestId } = render(<Probe />);
    const el = getByTestId('tilt-target') as HTMLDivElement;
    el.getBoundingClientRect = () => makeRect();

    act(() => {
      el.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
    });
    raf.flush(200);

    expect(parseFloat(el.style.getPropertyValue('--tilt-scale'))).toBeCloseTo(1.1, 2);
  });

  it('cleans up CSS vars + listeners on unmount', () => {
    window.matchMedia = makeMatchMedia(false);
    const raf = installRafStub();

    function Probe() {
      const { ref } = useTilt<HTMLDivElement>();
      return <div data-testid="tilt-target" ref={ref} style={{ width: 200, height: 200 }} />;
    }

    const { getByTestId, unmount } = render(<Probe />);
    const el = getByTestId('tilt-target') as HTMLDivElement;
    el.getBoundingClientRect = () => makeRect();

    // Drive the hook into a non-identity state.
    act(() => {
      el.dispatchEvent(new MouseEvent('mousemove', { clientX: 200, clientY: 200, bubbles: true }));
    });
    raf.flush(200);
    expect(el.style.getPropertyValue('--rx')).not.toBe('');

    // Capture the values just before unmount so we can prove unmount cleared them.
    unmount();

    // After unmount, the CSS vars must be cleared (re-mount safety).
    expect(el.style.getPropertyValue('--rx')).toBe('');
    expect(el.style.getPropertyValue('--ry')).toBe('');
    expect(el.style.getPropertyValue('--tilt-scale')).toBe('');

    // And further events must NOT mutate the (now detached) element — listeners removed.
    el.dispatchEvent(new MouseEvent('mousemove', { clientX: 100, clientY: 100, bubbles: true }));
    raf.flush(10);
    expect(el.style.getPropertyValue('--rx')).toBe('');
  });

  it('bails on zero-rect element — no NaN written into CSS vars', () => {
    window.matchMedia = makeMatchMedia(false);
    const raf = installRafStub();

    function Probe() {
      const { ref } = useTilt<HTMLDivElement>();
      return <div data-testid="tilt-target" ref={ref} />;
    }

    const { getByTestId } = render(<Probe />);
    const el = getByTestId('tilt-target') as HTMLDivElement;
    // Force a zero-size rect — without the guard, the (x - 0) / 0 division
    // would write `NaNdeg` into the CSS vars.
    el.getBoundingClientRect = () =>
      ({
        x: 0, y: 0, top: 0, left: 0, right: 0, bottom: 0,
        width: 0, height: 0,
        toJSON: () => ({}),
      }) as DOMRect;

    act(() => {
      el.dispatchEvent(new MouseEvent('mousemove', { clientX: 100, clientY: 100, bubbles: true }));
    });
    raf.flush(10);

    // mousemove bailed before touching target.rx/ry — no rAF loop, no vars written.
    expect(el.style.getPropertyValue('--rx')).toBe('');
    expect(el.style.getPropertyValue('--ry')).toBe('');
    expect(el.style.getPropertyValue('--tilt-scale')).toBe('');
  });

  it('enabled: false attaches no listeners and clears stale CSS vars', () => {
    window.matchMedia = makeMatchMedia(false);
    const raf = installRafStub();

    function Probe({ enabled }: { enabled: boolean }) {
      const { ref } = useTilt<HTMLDivElement>({ intensity: 10, enabled });
      return <div data-testid="tilt-target" ref={ref} style={{ width: 200, height: 200 }} />;
    }

    // First mount enabled — drive into a non-identity state.
    const { getByTestId, rerender } = render(<Probe enabled={true} />);
    const el = getByTestId('tilt-target') as HTMLDivElement;
    el.getBoundingClientRect = () => makeRect();
    act(() => {
      el.dispatchEvent(new MouseEvent('mousemove', { clientX: 200, clientY: 200, bubbles: true }));
    });
    raf.flush(200);
    expect(el.style.getPropertyValue('--rx')).not.toBe('');

    // Toggle to disabled — effect re-runs, clears CSS vars, attaches no new listeners.
    rerender(<Probe enabled={false} />);

    expect(el.style.getPropertyValue('--rx')).toBe('');
    expect(el.style.getPropertyValue('--ry')).toBe('');
    expect(el.style.getPropertyValue('--tilt-scale')).toBe('');

    // Subsequent mousemove must NOT write anything (listeners not attached).
    act(() => {
      el.dispatchEvent(new MouseEvent('mousemove', { clientX: 100, clientY: 100, bubbles: true }));
    });
    raf.flush(10);
    expect(el.style.getPropertyValue('--rx')).toBe('');
  });
});
