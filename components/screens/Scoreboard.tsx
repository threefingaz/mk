'use client';

// ScoreboardScreen — the "internet's verdict" surface (Task 15).
// Ported from design_handoff_old_blood_new_blood/design-reference/src/screens.jsx
// (function ScoreboardScreen, ~lines 265-358).
//
// Props-based per the pattern established in Task 11 (LandingScreen): the
// surface accepts the four crowd-state values directly rather than reading
// from the store. Keeps the component pure / easy to preview and lets
// app/scoreboard/page.tsx populate from mock data now and the live API later.
//
// Locked variant: brand mark, "BOARD UNLOCKS AT N PLAYS" headline, big
// countdown chip showing PLAYS LEFT (clamped 0+), and a SHARE TO HELP UNLOCK
// CTA that copies the page URL to the clipboard with a brief toast.
//
// Unlocked variant: 9 rows in canonical FIGHTERS order. Each row has the
// 1995 actor name in ob-mono cream, an <OldNewBar> in the middle, and the
// 2026 actor name in nb-mono mute. A small red winner dot floats on the
// winning side; ties show no dot.

import { useEffect, useState } from 'react';
import { BrandMark } from '@/components/BrandMark';
import { OldNewBar } from '@/components/OldNewBar';
import { FIGHTERS, type FighterId } from '@/lib/fighters';

export type ScoreboardStat = { old: number; new: number; total: number };

export type ScoreboardProps = {
  /** Whether the board is unlocked. Locked variant renders countdown UI. */
  unlocked: boolean;
  /** Per-fighter crowd stats. Only consulted when `unlocked === true`. */
  crowdStats: Partial<Record<FighterId, ScoreboardStat>>;
  /** Total completed plays. Used in the locked-variant countdown. */
  plays: number;
  /** Unlock threshold (REVEAL_AT). */
  threshold: number;
};

export function Scoreboard({ unlocked, crowdStats, plays, threshold }: ScoreboardProps) {
  const playsLeft = Math.max(0, threshold - plays);

  return (
    <div
      data-testid="scoreboard-screen"
      className="era-new"
      style={{
        position: 'relative',
        width: '100%',
        minHeight: '100vh',
        background: '#000',
      }}
    >
      <div
        style={{
          position: 'relative',
          zIndex: 4,
          padding: '32px 24px 24px',
          display: 'flex',
          flexDirection: 'column',
          gap: 20,
          maxWidth: 640,
          margin: '0 auto',
          minHeight: '100vh',
          boxSizing: 'border-box',
        }}
      >
        {/* Header — brand mark + section label. */}
        <header
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <BrandMark size={14} />
          <div
            className="nb-mono"
            style={{ fontSize: 10, letterSpacing: '0.25em', color: 'var(--nb-mute)' }}
          >
            SCOREBOARD
          </div>
        </header>

        {/* Title block */}
        <div>
          <div
            className="nb-mono"
            style={{ fontSize: 11, letterSpacing: '0.25em', color: 'var(--nb-mute)' }}
          >
            THE INTERNET&apos;S VERDICT
          </div>
          <h1
            className="nb-display nb-condensed"
            style={{
              fontSize: 40,
              lineHeight: 1,
              color: 'var(--nb-bone)',
              margin: '6px 0 0',
            }}
          >
            {unlocked ? 'RESULTS · LIVE' : 'RESULTS · LOCKED'}
          </h1>
        </div>

        {unlocked ? (
          <ScoreboardTable crowdStats={crowdStats} />
        ) : (
          <LockedView playsLeft={playsLeft} threshold={threshold} plays={plays} />
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Locked variant — countdown + share-hook CTA
// ─────────────────────────────────────────────────────────────
function LockedView({
  playsLeft,
  threshold,
  plays,
}: {
  playsLeft: number;
  threshold: number;
  plays: number;
}) {
  const progress = Math.min(100, Math.max(0, (plays / threshold) * 100));

  // Brief toast confirmation after Copy Link. 1.8s matches the Share-screen
  // pattern so toast behavior is consistent across surfaces.
  const [toast, setToast] = useState<string | null>(null);
  useEffect(() => {
    if (toast === null) return;
    const id = setTimeout(() => setToast(null), 1800);
    return () => clearTimeout(id);
  }, [toast]);

  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setToast('LINK COPIED');
    } catch {
      // Silent — non-critical action, matches the Share-screen Q7 stance.
    }
  };

  return (
    <div
      data-testid="scoreboard-locked"
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        gap: 20,
      }}
    >
      <div
        style={{
          border: '1px solid var(--nb-line)',
          background: 'rgba(255,255,255,0.02)',
          padding: 24,
          textAlign: 'center',
        }}
      >
        <div
          className="nb-mono"
          style={{
            fontSize: 12,
            letterSpacing: '0.18em',
            color: 'var(--nb-mute)',
            marginBottom: 12,
            textWrap: 'balance',
          }}
        >
          THE BOARD UNLOCKS AT {threshold} PLAYS
        </div>
        <div
          data-testid="scoreboard-countdown"
          className="nb-display nb-condensed"
          style={{ fontSize: 72, lineHeight: 0.9, color: 'var(--nb-red)' }}
        >
          {playsLeft}
        </div>
        <div
          className="nb-mono"
          style={{
            fontSize: 11,
            letterSpacing: '0.22em',
            color: 'var(--nb-mute)',
            marginTop: 4,
          }}
        >
          PLAYS LEFT
        </div>

        <div
          style={{
            marginTop: 20,
            height: 6,
            background: 'rgba(255,255,255,0.08)',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              height: '100%',
              background: 'linear-gradient(90deg, var(--nb-red-2), var(--nb-red))',
              width: `${progress}%`,
            }}
          />
        </div>
        <div
          className="nb-mono"
          style={{
            fontSize: 10,
            letterSpacing: '0.18em',
            color: 'var(--nb-mute)',
            marginTop: 8,
            display: 'flex',
            justifyContent: 'space-between',
          }}
        >
          <span>
            {plays} / {threshold}
          </span>
          <span>VOTES IN</span>
        </div>
      </div>

      {/* CTA — copies the page URL to the clipboard so the visitor can paste
          it anywhere. Mirrors the Share screen's Copy Link pattern. */}
      <button
        type="button"
        className="btn-new btn-new-red"
        data-testid="scoreboard-share-cta"
        onClick={() => void handleShare()}
        style={{
          alignSelf: 'stretch',
          textAlign: 'center',
          justifyContent: 'center',
          padding: '16px',
          fontSize: 14,
          letterSpacing: '0.12em',
        }}
      >
        SHARE TO HELP UNLOCK →
      </button>

      {toast !== null ? (
        <div
          role="status"
          aria-live="polite"
          data-testid="scoreboard-copied-toast"
          className="nb-mono"
          style={{
            position: 'fixed',
            left: '50%',
            bottom: 32,
            transform: 'translateX(-50%)',
            padding: '8px 14px',
            background: 'rgba(0,0,0,0.85)',
            border: '1px solid var(--nb-line)',
            color: 'var(--nb-bone)',
            fontSize: 11,
            letterSpacing: '0.2em',
            zIndex: 10,
            pointerEvents: 'none',
            maxWidth: '90vw',
            textAlign: 'center',
          }}
        >
          {toast}
        </div>
      ) : null}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Unlocked variant — 9-row table
// ─────────────────────────────────────────────────────────────
function ScoreboardTable({
  crowdStats,
}: {
  crowdStats: Partial<Record<FighterId, ScoreboardStat>>;
}) {
  return (
    <ul
      data-testid="scoreboard-table"
      style={{
        flex: 1,
        listStyle: 'none',
        padding: 0,
        margin: 0,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}
    >
      {FIGHTERS.map((fighter) => {
        const stats = crowdStats[fighter.id] ?? { old: 0, new: 0, total: 0 };
        return (
          <ScoreboardRow
            key={fighter.id}
            name={fighter.name.toUpperCase()}
            oldActor={fighter.oldActor}
            newActor={fighter.newActor}
            stats={stats}
          />
        );
      })}
    </ul>
  );
}

function ScoreboardRow({
  name,
  oldActor,
  newActor,
  stats,
}: {
  name: string;
  oldActor: string;
  newActor: string;
  stats: ScoreboardStat;
}) {
  // Winner side: null on ties (no dot rendered) per Task 15 spec.
  const winner: 'old' | 'new' | null =
    stats.old > stats.new ? 'old' : stats.new > stats.old ? 'new' : null;

  return (
    <li
      data-testid={`scoreboard-row-${name.toLowerCase().replace(/\s+/g, '-')}`}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        padding: '10px 0',
        borderBottom: '1px solid var(--nb-line)',
      }}
    >
      {/* Fighter name + winner dot */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          gap: 8,
        }}
      >
        <div
          className="nb-display nb-condensed"
          style={{ fontSize: 18, lineHeight: 1, color: 'var(--nb-bone)' }}
        >
          {name}
        </div>
        {winner ? (
          <span
            data-testid={`scoreboard-winner-${winner}`}
            aria-label={`${winner === 'old' ? '1995' : '2026'} side leads`}
            style={{
              width: 8,
              height: 8,
              borderRadius: 0,
              background: 'var(--nb-red)',
              display: 'inline-block',
            }}
          />
        ) : null}
      </div>

      {/* Old/New bar */}
      <OldNewBar oldPicks={stats.old} newPicks={stats.new} height={12} />

      {/* Actor row — 1995 left (cream ob-mono), 2026 right (mute nb-mono).
          The winner dot is rendered up in the name row (top-right of card) so
          this row stays purely typographic. */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          gap: 8,
        }}
      >
        <span
          className="ob-mono"
          style={{
            fontSize: 10,
            color: 'var(--ob-bone)',
            letterSpacing: '0.04em',
          }}
        >
          {oldActor}
        </span>
        <span
          className="nb-mono"
          style={{
            fontSize: 10,
            color: 'var(--nb-mute)',
            letterSpacing: '0.06em',
          }}
        >
          {newActor}
        </span>
      </div>
    </li>
  );
}
