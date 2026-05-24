'use client';

// UnlockMomentScreen — the one-time celebratory event when the scoreboard
// goes live (Task 16). Gated by `seenUnlock` on the identity slice. The flag
// is flipped when the user clicks SEE THE BOARD (acknowledgement), NOT on
// mount: flipping on mount would re-trigger app/page.tsx's routing precedence
// and the user would see this screen for a single render frame before being
// bounced. Click-to-acknowledge also matches the "must be seen" semantic — a
// hard refresh before clicking re-shows the screen, which is the right call.
//
// Ported from design_handoff_old_blood_new_blood/design-reference/src/screens.jsx
// (function UnlockMomentScreen, ~lines 446-501).
//
// Expected usage (wired in Task 17):
//   <UnlockMoment plays={results.plays} />
//   Mount-time routing precedence (Task 17):
//     scoreboardUnlocked && hasVoted && !seenUnlock  → UnlockMoment
//
// Production deltas vs prototype:
//   - Single CTA: SEE THE BOARD → /scoreboard (per plan). The prototype's
//     second "NEW VERDICT" CTA is dropped per Q2 (no replays).
//   - Subhead reads PLAYS LOGGED · CROWD VERDICTS NOW VISIBLE, parameterized
//     by `plays`.
//   - Decorative confetti-style particle burst — CSS-only, a handful of
//     absolutely-positioned divs using pulse-red + small inline keyframe.

import { useEffect } from 'react';
import Link from 'next/link';
import { BrandMark } from '@/components/BrandMark';
import { useIdentityStore } from '@/lib/store';
import { trackEvent } from '@/lib/analytics';

export type UnlockMomentProps = {
  /** Total plays logged on the server when the board flipped open. */
  plays?: number;
};

// Static-ish particle positions — deterministic so SSR/CSR agree (no Math.random
// at render time). 14 dots, mix of red + cream, scattered across the upper hero.
const PARTICLES: ReadonlyArray<{
  left: string;
  top: string;
  size: number;
  color: 'red' | 'bone';
  delay: string;
}> = [
  { left: '12%', top: '18%', size: 6, color: 'red', delay: '0s' },
  { left: '22%', top: '32%', size: 4, color: 'bone', delay: '0.2s' },
  { left: '34%', top: '12%', size: 5, color: 'red', delay: '0.4s' },
  { left: '46%', top: '24%', size: 3, color: 'bone', delay: '0.1s' },
  { left: '58%', top: '14%', size: 6, color: 'red', delay: '0.3s' },
  { left: '70%', top: '28%', size: 4, color: 'bone', delay: '0.5s' },
  { left: '84%', top: '20%', size: 5, color: 'red', delay: '0.15s' },
  { left: '16%', top: '46%', size: 3, color: 'bone', delay: '0.35s' },
  { left: '28%', top: '54%', size: 5, color: 'red', delay: '0.55s' },
  { left: '50%', top: '50%', size: 4, color: 'bone', delay: '0.05s' },
  { left: '62%', top: '58%', size: 5, color: 'red', delay: '0.45s' },
  { left: '76%', top: '48%', size: 3, color: 'bone', delay: '0.25s' },
  { left: '88%', top: '40%', size: 6, color: 'red', delay: '0.6s' },
  { left: '8%', top: '38%', size: 4, color: 'red', delay: '0.5s' },
];

export function UnlockMoment({ plays = 30 }: UnlockMomentProps) {
  const markUnlockSeen = useIdentityStore((s) => s.markUnlockSeen);

  // Analytics: fire `unlock_moment_shown` once per mount (Task 17b). Kept in
  // a mount effect with empty deps so it stays a pure mount signal — fires
  // every time the screen is rendered (e.g. user refreshes before clicking).
  useEffect(() => {
    trackEvent({ name: 'unlock_moment_shown' });
  }, []);

  // Acknowledgement: flip seenUnlock when the user clicks the CTA. Done in
  // the handler (not on mount) so the parent's routing precedence doesn't
  // re-render this away mid-frame; also matches the "must be seen" semantic
  // — a refresh before clicking re-shows the screen.
  const handleAcknowledge = () => {
    markUnlockSeen();
  };

  return (
    <div
      data-testid="unlock-moment-screen"
      className="era-new"
      style={{
        position: 'relative',
        width: '100%',
        minHeight: '100vh',
        background: '#000',
        overflow: 'hidden',
      }}
    >
      {/* Spotlight glow centered at the headline — matches the prototype's
          "RESULTS UNLOCKED" moment. */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'radial-gradient(ellipse at 50% 40%, oklch(0.55 0.24 27 / 0.45), transparent 60%)',
          pointerEvents: 'none',
        }}
      />

      {/* Decorative confetti — pure CSS, animation references styles.css's
          pulse-red keyframe. Cream dots use a quiet opacity pulse. */}
      <div aria-hidden style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
        {PARTICLES.map((p, i) => (
          <div
            key={i}
            data-testid="unlock-particle"
            style={{
              position: 'absolute',
              left: p.left,
              top: p.top,
              width: p.size,
              height: p.size,
              background: p.color === 'red' ? 'var(--nb-red)' : 'var(--nb-bone)',
              animation: 'pulse-red 1.4s infinite',
              animationDelay: p.delay,
              opacity: p.color === 'red' ? 1 : 0.6,
              borderRadius: 1,
            }}
          />
        ))}
      </div>

      <div
        style={{
          position: 'relative',
          zIndex: 4,
          padding: '24px 20px',
          display: 'flex',
          flexDirection: 'column',
          minHeight: '100vh',
          boxSizing: 'border-box',
        }}
      >
        {/* Header — brand + LIVE chip (matches prototype layout). */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <BrandMark size={11} />
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '4px 10px',
              border: '1px solid var(--nb-red)',
              background: 'rgba(0,0,0,0.4)',
            }}
          >
            <div
              style={{
                width: 6,
                height: 6,
                background: 'var(--nb-red)',
                animation: 'pulse-red 1.4s infinite',
              }}
            />
            <div
              className="nb-mono"
              style={{
                fontSize: 9,
                letterSpacing: '0.2em',
                color: 'var(--nb-bone)',
              }}
            >
              LIVE
            </div>
          </div>
        </div>

        {/* Center stack — eyebrow, big headline, subhead. */}
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            textAlign: 'center',
            gap: 16,
          }}
        >
          <div
            className="nb-mono"
            style={{
              fontSize: 10,
              letterSpacing: '0.4em',
              color: 'var(--nb-red)',
              animation: 'glitch-x 4s infinite',
            }}
          >
            ·  ALL VOTES IN  ·
          </div>

          <div
            data-testid="unlock-headline"
            className="nb-display nb-condensed"
            style={{
              fontSize: 64,
              lineHeight: 0.85,
              color: 'var(--nb-bone)',
              letterSpacing: '0.005em',
              textShadow: '0 6px 30px oklch(0.55 0.24 27 / 0.5)',
              animation: 'reveal-up .8s cubic-bezier(.2,.7,.3,1)',
            }}
          >
            THE BOARD
            <br />
            IS LIVE
          </div>

          <div
            data-testid="unlock-subhead"
            className="nb-mono"
            style={{
              fontSize: 11,
              letterSpacing: '0.18em',
              color: 'var(--nb-mute)',
              maxWidth: 320,
              textWrap: 'balance',
            }}
          >
            {plays} PLAYS LOGGED · CROWD VERDICTS NOW VISIBLE
          </div>
        </div>

        {/* CTA — single per plan (no NEW VERDICT, per Q2 no-replays). */}
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <Link
            href="/scoreboard"
            onClick={handleAcknowledge}
            className="btn-new btn-new-red"
            data-testid="unlock-cta-scoreboard"
            style={{
              fontSize: 14,
              padding: '14px 28px',
              justifyContent: 'center',
              textAlign: 'center',
              textDecoration: 'none',
              display: 'inline-flex',
              alignItems: 'center',
              minWidth: 220,
            }}
          >
            SEE THE BOARD →
          </Link>
        </div>
      </div>
    </div>
  );
}
