'use client';

// Root state-machine page (Task 17).
//
// Reads `phase` from useRunStore + `hasVoted` / `seenUnlock` from
// useIdentityStore + `scoreboardUnlocked` from useRunStore's CrowdState slice,
// then dispatches to the correct screen.
//
// Routing precedence (matches plan Task 17 + Q9):
//   1. In-run phases take precedence: duel | verdict render directly.
//   2. When phase === 'landing':
//      a. scoreboardUnlocked && hasVoted && !seenUnlock  → <UnlockMoment />
//      b. hasVoted                                       → <ReturningVisitor />
//      c. else                                           → <Landing />
//
// Persistent overlays render regardless of phase: <DisclaimerRibbon>
// (normal-flow `<div>` rendered at the bottom of the page after the cap-lift,
// full-bleed). <MuteToggle> renders fixed at bottom-right of the viewport on
// every screen EXCEPT Landing, which has its own inline MuteToggle above the
// FIGHT button (front-and-center before the first audio plays).
//
// Phase 2 (Task 25): crowd state comes from /api/results via the resilience
// client (lib/api-client.ts). Failures resolve to a synthesized pre-unlock
// payload so the UI degrades silently.
//
// SSR / hydration contract:
//   The persist middleware reads sessionStorage/localStorage on the client
//   only. To avoid a hydration mismatch where the server renders one screen
//   (default-state Landing) and the client immediately swaps to a different
//   one (e.g. ReturningVisitor) after rehydration, we gate the routing
//   decision behind a `hydrated` flag flipped in useEffect. Until then we
//   render the Landing screen as a safe default — first-time visitors are
//   the most likely state, so this is also the fastest visual path.

import { useEffect } from 'react';
import { DisclaimerRibbon } from '@/components/DisclaimerRibbon';
import { MuteToggle } from '@/components/MuteToggle';
import { Landing } from '@/components/screens/Landing';
import { Duel } from '@/components/screens/Duel';
import { Verdict } from '@/components/screens/Verdict';
import { UnlockMoment } from '@/components/screens/UnlockMoment';
import { ReturningVisitor } from '@/components/screens/ReturningVisitor';
import { fetchResults } from '@/lib/api-client';
import { useIdentityStore, useRunStore } from '@/lib/store';
import { setBgLoop, setMuted as setAudioMuted, unlockAudio } from '@/lib/audio';
import { useHydrated } from '@/hooks/useHydrated';

// Full-viewport canvas wrapper. v1 is mobile-first but the desktop layout
// (Task 1 of the desktop-layout plan) lifts the 480px cap so each screen owns
// its own content max-width via inline `clamp()` + the `.content-column`
// helper in globals.css. Era backdrops naturally fill the viewport at any
// width because they use absolute-positioned `.era-old` / `.era-new` halves.
const PAGE_FRAME_STYLE = {
  width: '100%',
  minHeight: '100vh',
  position: 'relative' as const,
  background: '#000',
  overflow: 'hidden' as const,
};

function PageBody() {
  // ── Crowd-state hydration ────────────────────────────────────────────────
  // Mount-time call to /api/results via the resilience client. On success
  // we get { unlocked, plays, threshold, stats? }; on any failure we get
  // the synthesized fallback { unlocked: false, plays: 0, threshold: 30 },
  // which renders the pre-unlock UI without any error surfacing.
  //
  // We unconditionally write all three slices — fetchResults() never throws,
  // so the inner branch always runs. `stats ?? {}` collapses pre-unlock
  // (stats undefined) into an empty crowdStats map.

  const setUnlocked = useRunStore((s) => s.setUnlocked);
  const setCrowdStats = useRunStore((s) => s.setCrowdStats);
  const setUnlockProgress = useRunStore((s) => s.setUnlockProgress);

  useEffect(() => {
    let cancelled = false;
    void fetchResults().then((results) => {
      if (cancelled) return;
      setUnlocked(results.unlocked);
      setCrowdStats(results.stats ?? {});
      setUnlockProgress({ plays: results.plays, threshold: results.threshold });
    });
    return () => {
      cancelled = true;
    };
  }, [setUnlocked, setCrowdStats, setUnlockProgress]);

  // ── Hydration gate ───────────────────────────────────────────────────────
  // The routing decision depends on persisted identity state (hasVoted,
  // seenUnlock). On the server those are always at their defaults, so to
  // avoid a hydration mismatch when the client rehydrates from localStorage
  // we render the safe default (Landing) until hydrated. See hooks/useHydrated.
  const hydrated = useHydrated();

  // ── Store reads ──────────────────────────────────────────────────────────

  const phase = useRunStore((s) => s.phase);
  const plays = useRunStore((s) => s.plays);
  const threshold = useRunStore((s) => s.threshold);
  const scoreboardUnlocked = useRunStore((s) => s.scoreboardUnlocked);

  const hasVoted = useIdentityStore((s) => s.hasVoted);
  const seenUnlock = useIdentityStore((s) => s.seenUnlock);
  const muted = useIdentityStore((s) => s.muted);
  const setMuted = useIdentityStore((s) => s.setMuted);

  // Bridge the identity-store `muted` flag into the audio module so all
  // playback short-circuits when the user has muted. The store is the source
  // of truth (Task 18); this effect just keeps the audio module in sync.
  useEffect(() => {
    setAudioMuted(muted);
  }, [muted]);

  // Declare bg-loop intent once on mount. The audio module starts the loop
  // when both conditions become true (unlocked + !muted) and stops it on mute,
  // so this is a fire-and-forget statement of intent.
  useEffect(() => {
    setBgLoop(true);
  }, []);

  // ── Render selection ─────────────────────────────────────────────────────

  let screen: React.ReactNode;
  // Track whether Landing is being rendered so we can suppress the global
  // fixed MuteToggle (Landing renders its own inline above the FIGHT button).
  let isLanding = false;

  if (!hydrated) {
    // SSR-safe default. First render on the client (pre-rehydration) and the
    // server render both end up here. Pre-paints the most-common state.
    screen = <Landing plays={plays} threshold={threshold} />;
    isLanding = true;
  } else if (phase === 'duel') {
    screen = <Duel />;
  } else if (phase === 'verdict') {
    screen = <Verdict />;
  } else if (scoreboardUnlocked && hasVoted && !seenUnlock) {
    screen = <UnlockMoment plays={plays} />;
  } else if (hasVoted) {
    screen = <ReturningVisitor plays={plays} threshold={threshold} />;
  } else {
    screen = <Landing plays={plays} threshold={threshold} />;
    isLanding = true;
  }

  return (
    <main style={PAGE_FRAME_STYLE}>
      {screen}
      {/* Persistent overlays — render regardless of phase, EXCEPT the
          MuteToggle on Landing (Landing has its own inline copy). */}
      {!isLanding && (
        <MuteToggle
          muted={muted}
          onToggle={() => {
            const nextMuted = !muted;
            // Push the new muted state into the audio module synchronously so
            // the useEffect bridge doesn't race with unlockAudio()'s
            // tryStartBgLoop() — otherwise clicking to mute can briefly start
            // the bg loop with a cached sample.
            setAudioMuted(nextMuted);
            setMuted(nextMuted);
            // The toggle click is a valid user gesture for the AudioContext,
            // but only worth unlocking on the unmute direction.
            if (!nextMuted) void unlockAudio();
          }}
        />
      )}
      <DisclaimerRibbon />
    </main>
  );
}

export default function Home() {
  return <PageBody />;
}
