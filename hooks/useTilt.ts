'use client';

// useTilt — cursor-following 3D tilt with critically-damped spring + hover lift.
//
// Originally ported from design_handoff_old_blood_new_blood/design-reference/src/system.jsx
// (useTilt). The first production iteration set CSS custom properties via React state on
// every rAF tick, which forced a re-render per animation frame. This version mutates
// `--rx`, `--ry`, and `--tilt-scale` directly on the ref's `.style` so the hot path
// stays out of React entirely. The hook returns only a ref — live values flow through
// CSS custom properties consumed by the `.tilt` rule in `app/globals.css`.
//
// Behavior:
// - On `mousemove`, computes the target rotation from cursor position relative to the
//   element's bounding rect. A single self-terminating rAF loop lerps current toward
//   target with a critically-damped smoothing factor (~0.2 → ~10 frames to settle).
// - On `mouseenter`, the target scale is set to `hoverScale` (default 1.03).
// - On `mouseleave`, the target collapses to identity (0deg, 0deg, scale 1). The loop
//   continues until it has settled within an epsilon of identity, then stops.
// - Bails on `prefers-reduced-motion: reduce` — attaches no listeners, performs no rAF
//   work. The reduced-motion media block in `globals.css` is the belt; this is the
//   suspenders.
// - Bails on touch / coarse-pointer devices (`(hover: hover) and (pointer: fine)` does
//   NOT match) — touch browsers synthesize `mouseenter`/`mousemove` after a tap, which
//   would leave the card stuck in a rotated/scaled state. Same belt-and-suspenders
//   pattern as reduced-motion: the matching `@media` gate around the era-aware hover
//   shadow rules in `globals.css` is the belt; this hook bail is the suspenders.
//   One-time check at effect mount — we don't listen for matchMedia changes (the
//   convertible-laptop input-mode-switch edge case is too rare to justify the
//   complexity).
// - SSR-safe: `window`, `matchMedia`, and `requestAnimationFrame` are all guarded so
//   the hook degrades to a bare ref on the server (and during the first client render
//   before effects run).
// - `enabled: false` opt-out: callers (e.g. dimmed EraCard) can suppress the hook
//   entirely. No listeners, no rAF; any pre-existing `--rx`/`--ry`/`--tilt-scale`
//   on the element are cleared so the cascade snaps back to identity cleanly.
//
// API (back-compatible):
//   const { ref } = useTilt();                                        // intensity 10, hoverScale 1.03
//   const { ref } = useTilt(8);                                       // intensity 8 (positional, legacy)
//   const { ref } = useTilt({ intensity: 8, hoverScale: 1 });
//   const { ref } = useTilt({ intensity: 8, enabled: false });        // hook is a no-op

import { useEffect, useRef, type RefObject } from 'react';

export type UseTiltOptions = {
  intensity?: number;
  hoverScale?: number;
  /**
   * Default true. When false, the hook attaches no listeners and clears any
   * stale CSS custom properties. Use this for callers that conditionally
   * suppress the lift (e.g. dimmed EraCard) instead of skipping the hook
   * call (rules of hooks).
   */
  enabled?: boolean;
};

export type UseTiltResult<T extends HTMLElement = HTMLElement> = {
  ref: RefObject<T | null>;
};

const SMOOTHING = 0.2;
const EPSILON = 0.001;

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function canHover(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia('(hover: hover) and (pointer: fine)').matches;
}

export function useTilt<T extends HTMLElement = HTMLElement>(
  arg?: number | UseTiltOptions,
): UseTiltResult<T> {
  const intensity = typeof arg === 'number' ? arg : (arg?.intensity ?? 10);
  const hoverScale = typeof arg === 'number' ? 1.03 : (arg?.hoverScale ?? 1.03);
  const enabled = typeof arg === 'number' ? true : (arg?.enabled ?? true);
  const ref = useRef<T | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof window === 'undefined') return;
    if (typeof window.requestAnimationFrame !== 'function') return;

    // Helper: clear any stale CSS vars left from a previous active phase so
    // the cascade reads identity. Used both on disabled-bail and on cleanup.
    const clearVars = () => {
      el.style.removeProperty('--rx');
      el.style.removeProperty('--ry');
      el.style.removeProperty('--tilt-scale');
    };

    if (!enabled) {
      clearVars();
      return;
    }
    if (prefersReducedMotion()) return;
    if (!canHover()) return;

    const target = { rx: 0, ry: 0, scale: 1 };
    const current = { rx: 0, ry: 0, scale: 1 };
    let raf = 0;
    let running = false;

    const writeVars = () => {
      el.style.setProperty('--rx', `${current.rx}deg`);
      el.style.setProperty('--ry', `${current.ry}deg`);
      el.style.setProperty('--tilt-scale', String(current.scale));
    };

    const tick = () => {
      current.rx += (target.rx - current.rx) * SMOOTHING;
      current.ry += (target.ry - current.ry) * SMOOTHING;
      current.scale += (target.scale - current.scale) * SMOOTHING;
      writeVars();

      const settled =
        Math.abs(target.rx - current.rx) < EPSILON &&
        Math.abs(target.ry - current.ry) < EPSILON &&
        Math.abs(target.scale - current.scale) < EPSILON;

      if (settled) {
        running = false;
        return;
      }
      raf = window.requestAnimationFrame(tick);
    };

    const start = () => {
      if (running) return;
      running = true;
      raf = window.requestAnimationFrame(tick);
    };

    const onEnter = () => {
      target.scale = hoverScale;
      start();
    };

    const onMove = (e: MouseEvent) => {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) return;
      const x = (e.clientX - r.left) / r.width - 0.5;
      const y = (e.clientY - r.top) / r.height - 0.5;
      target.rx = -y * intensity;
      target.ry = x * intensity;
      target.scale = hoverScale;
      start();
    };

    const onLeave = () => {
      target.rx = 0;
      target.ry = 0;
      target.scale = 1;
      start();
    };

    el.addEventListener('mouseenter', onEnter);
    el.addEventListener('mousemove', onMove);
    el.addEventListener('mouseleave', onLeave);
    return () => {
      el.removeEventListener('mouseenter', onEnter);
      el.removeEventListener('mousemove', onMove);
      el.removeEventListener('mouseleave', onLeave);
      window.cancelAnimationFrame(raf);
      running = false;
      // Reset to identity so a re-mount or option change doesn't leave a stale transform.
      clearVars();
    };
  }, [intensity, hoverScale, enabled]);

  return { ref };
}
