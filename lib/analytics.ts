// Analytics — typed wrapper around @vercel/analytics's `track()` (Task 17b).
//
// Vercel Analytics auto-captures pageviews via the <Analytics /> component
// mounted in app/layout.tsx. This module exposes a typed `trackEvent()` for
// the 7 custom funnel events described in the plan (Q11):
//
//   1. run_start            — FIGHT CTA click on Landing
//   2. pick                 — each duel pick (fighter_id, era, step)
//   3. run_complete         — Verdict mount (archetype, old_picks)
//   4. share_open           — Share screen mount
//   5. share_click          — each share method click (method)
//   6. r_view               — /r/[code] mount
//   7. unlock_moment_shown  — UnlockMoment mount
//
// Note: Vercel's `track()` is a thin wrapper around a queued `fetch('/_vercel/insights')`
// in the browser. It's a no-op on the server, so safe to call from any client component.

import { track } from '@vercel/analytics';

export type AnalyticsEvent =
  | { name: 'run_start'; props?: Record<string, never> }
  | { name: 'pick'; props: { fighter_id: string; era: 'old' | 'new'; step: number } }
  | { name: 'run_complete'; props: { archetype: string; old_picks: number } }
  | { name: 'share_open'; props?: Record<string, never> }
  | {
      name: 'share_click';
      props: { method: 'copy' | 'native' | 'download' | 'x' | 'instagram' | 'tiktok' };
    }
  | { name: 'r_view'; props?: Record<string, never> }
  | { name: 'unlock_moment_shown'; props?: Record<string, never> };

/**
 * Type-safe dispatcher. The discriminated union narrows props at the call
 * site, giving exhaustive prop checking for every event name.
 */
export function trackEvent<E extends AnalyticsEvent>(event: E): void {
  // Vercel's track signature accepts `Record<string, AllowedPropertyValues>`,
  // which is structurally compatible with our prop shapes.
  track(event.name, (event.props ?? {}) as Record<string, string | number | boolean | null>);
}
