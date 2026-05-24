'use client';

// useTilt — cursor-following 3D tilt with reduced-motion bail.
//
// Ported from design_handoff_old_blood_new_blood/design-reference/src/system.jsx (useTilt).
// The prototype set CSS custom properties (`--rx`, `--ry`) directly on the DOM element so
// `styles.css` could compose them into a `transform: perspective(...) rotateX(...) rotateY(...)`.
// The production hook keeps that contract but returns `{ ref, style }` so callers can spread
// the style onto whatever element they like (and so tests can read the current transform
// without scraping inline DOM properties).
//
// Behavior:
// - rAF-throttled mousemove handler; one frame per move event, prior frame cancelled.
// - Max ±`intensity` degrees on each axis (defaults to 10° per the spec).
// - On mouse leave, the transform smoothly resets via the CSS transition already on the card
//   (we simply zero the values).
// - Bails on `prefers-reduced-motion: reduce` — returns an empty `style` so the element stays
//   flat. The reduced-motion media block in `styles.css` is the belt; this is the suspenders.
// - SSR-safe: `window`, `matchMedia`, and `requestAnimationFrame` are all guarded so the hook
//   degrades to identity on the server (and during the first client render before effects run).

import { useEffect, useRef, useState, type CSSProperties, type RefObject } from 'react';

type TiltStyle = CSSProperties & {
  '--rx'?: string;
  '--ry'?: string;
};

export type UseTiltResult = {
  ref: RefObject<HTMLElement | null>;
  style: TiltStyle;
};

const IDENTITY_STYLE: TiltStyle = {};

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function useTilt(intensity: number = 10): UseTiltResult {
  const ref = useRef<HTMLElement | null>(null);
  const [style, setStyle] = useState<TiltStyle>(IDENTITY_STYLE);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof window === 'undefined') return;
    if (typeof window.requestAnimationFrame !== 'function') return;
    if (prefersReducedMotion()) return;

    let raf = 0;

    const apply = (rx: number, ry: number) => {
      setStyle({
        '--rx': `${rx}deg`,
        '--ry': `${ry}deg`,
        transform: `perspective(1000px) rotateX(${rx}deg) rotateY(${ry}deg)`,
      });
    };

    const onMove = (e: MouseEvent) => {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) return;
      const x = (e.clientX - r.left) / r.width - 0.5;
      const y = (e.clientY - r.top) / r.height - 0.5;
      window.cancelAnimationFrame(raf);
      raf = window.requestAnimationFrame(() => {
        apply(-y * intensity, x * intensity);
      });
    };

    const onLeave = () => {
      window.cancelAnimationFrame(raf);
      apply(0, 0);
    };

    el.addEventListener('mousemove', onMove);
    el.addEventListener('mouseleave', onLeave);
    return () => {
      el.removeEventListener('mousemove', onMove);
      el.removeEventListener('mouseleave', onLeave);
      window.cancelAnimationFrame(raf);
    };
  }, [intensity]);

  return { ref, style };
}
