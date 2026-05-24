'use client';

// VerdictCard — the trading-card-shaped verdict artifact (Task 13).
//
// Ported from design_handoff_old_blood_new_blood/design-reference/src/cards.jsx
// (function VerdictCardA, lines ~85-203), restructured to consume a RunResult
// from lib/run-result.ts rather than the prototype's hardcoded DEMO_RESULT.
//
// Key shape (per plan Task 13):
//   - 4:5 aspect (via aspectRatio CSS; the parent screen also enforces this on
//     its scaling box, so the card composes inside either container).
//   - Top archetype band: archetype name in display lockup on top of the user's
//     dominant era's background skin (era-old when oldPicks >= 5, else era-new).
//   - Middle: 3×3 mini-card grid showing each of the 9 picks, era-themed per the
//     player's choice; red 2px boxShadow ring on rows where choice !== majority
//     (only when crowd data exists — `unlocked` mode).
//   - Bottom: stats lockup "{oldPicks}/9 OLD · {newPicks}/9 NEW [· {defied}/9 CONTRARIAN]".
//   - Optional kicker (unlocked only): "YOU DEFIED THE CROWD N TIMES" / "YOU MOVED WITH THE CROWD".
//
// CTAs (share, scoreboard) are NOT in the card — they live on the parent
// VerdictRevealScreen / share screen. The card is the shareable artifact only.
//
// useTilt is applied to the outer card div for desktop hover; reduced-motion is
// respected internally by the hook.

import type { CSSProperties } from 'react';
import { useTilt } from '@/hooks/useTilt';
import { Silhouette } from '@/components/Silhouette';
import { FIGHTERS, getFighter, type Era, type FighterId } from '@/lib/fighters';
import type { PickRow, RunResult } from '@/lib/run-result';

// Each of the 9 mini-cells in the pick grid. The cell's era theme follows the
// player's choice for that fighter. Contrarian rows get a red ring (unlocked
// only — pre-unlock `majority` is null and no ring renders).
function PickCell({ row }: { row: PickRow }) {
  const fighter = getFighter(row.fighter);
  const era = row.choice;
  const isContrarian = row.majority !== null && row.choice !== row.majority;

  const ringStyle: CSSProperties = isContrarian
    ? { boxShadow: '0 0 0 2px var(--nb-red)' }
    : {};

  return (
    <div
      data-testid={`verdict-pick-cell-${row.fighter}`}
      data-contrarian={isContrarian ? 'true' : 'false'}
      className={`era-${era}`}
      style={{
        position: 'relative',
        aspectRatio: '4 / 5',
        overflow: 'hidden',
        background: '#000',
        ...ringStyle,
      }}
    >
      {/* Silhouette fills the cell — production portraits drop in later via
          <Portrait>, but VerdictCard ships with silhouettes so the grid stays
          dense and legible at this size even without art assets. */}
      <div style={{ position: 'absolute', inset: 0 }}>
        <Silhouette kind={fighter.silhouette} era={era} />
      </div>

      {/* Bottom actor-name band. Era-specific font + treatment. */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          padding: '3px 4px',
          background: 'rgba(0,0,0,0.6)',
          borderTop: '1px solid rgba(255,255,255,0.12)',
        }}
      >
        <div
          className={era === 'old' ? 'ob-mono' : 'nb-mono'}
          style={{
            fontSize: 7,
            letterSpacing: '0.05em',
            color: era === 'old' ? 'var(--ob-bone)' : 'var(--nb-bone)',
            textAlign: 'center',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {era === 'old' ? fighter.oldActor : fighter.newActor}
        </div>
      </div>
    </div>
  );
}

export function VerdictCard({ result }: { result: RunResult }) {
  // n1 vs unlocked is determined by RunResult.defied: pre-unlock or no crowd
  // data surfaces as `defied === null` from computeRunResult.
  const unlocked = result.defied !== null;
  const dom: Era = result.oldPicks >= 5 ? 'old' : 'new';
  const arch = result.archetype;
  // Destructure both `ref` and `style` from the hook so the linter's
  // react-hooks/refs check doesn't mistake `tilt.style` for a ref access
  // (the rule flags any property access on an object that also holds a ref).
  const { ref: tiltRef, style: tiltStyle } = useTilt(8);

  // Sort pick rows back into FIGHTERS canonical order so the grid is stable
  // across runs (different orders shouldn't shuffle the grid layout).
  // Type assertion is sufficient: every fighter has a row after a complete run.
  const orderedRows: PickRow[] = FIGHTERS.map(
    (f) => result.picks.find((p) => p.fighter === (f.id as FighterId)) as PickRow,
  );

  const kicker = unlocked
    ? (result.defied ?? 0) > 0
      ? `YOU DEFIED THE CROWD ${result.defied} TIMES`
      : 'YOU MOVED WITH THE CROWD'
    : null;

  // Outer card sets the 4:5 aspect (the parent screen scaling box also enforces
  // this — defense in depth so the card holds its shape if dropped into a
  // square or letterboxed container).
  return (
    <div
      ref={tiltRef as React.RefObject<HTMLDivElement>}
      data-testid="verdict-card"
      data-mode={unlocked ? 'unlocked' : 'n1'}
      className="tilt"
      style={{
        position: 'relative',
        width: '100%',
        aspectRatio: '4 / 5',
        background: '#000',
        overflow: 'hidden',
        ...tiltStyle,
      }}
    >
      {/* Dominant-era background fills the whole card — the era's tracking
          sweep + base color show through behind the grid + bands. */}
      <div
        aria-hidden
        className={dom === 'old' ? 'era-old' : 'era-new'}
        style={{ position: 'absolute', inset: 0 }}
      />

      <div
        className="tilt-inner"
        style={{
          position: 'relative',
          zIndex: 4,
          height: '100%',
          padding: '6% 6% 7%',
          display: 'flex',
          flexDirection: 'column',
          gap: '4%',
        }}
      >
        {/* Top — archetype band. Display lockup over the dominant-era field. */}
        <div style={{ textAlign: 'center' }}>
          <div
            className="nb-mono"
            style={{
              fontSize: 10,
              letterSpacing: '0.3em',
              color: 'rgba(255,255,255,0.7)',
              marginBottom: 6,
            }}
          >
            YOU ARE
          </div>
          <div
            className="ob-display ob-chromatic"
            style={{
              fontSize: 'clamp(22px, 8cqw, 44px)',
              lineHeight: 0.95,
              color: 'var(--nb-bone)',
              textTransform: 'uppercase',
              fontFamily: dom === 'old' ? 'var(--f-disp-old)' : 'var(--f-disp-new)',
              textShadow:
                dom === 'old'
                  ? '2px 0 0 var(--ob-cyan), -2px 0 0 var(--ob-magenta)'
                  : '0 4px 24px oklch(0.55 0.24 27 / 0.6)',
            }}
          >
            {arch.name}
          </div>
        </div>

        {/* Middle — 3×3 pick grid. */}
        <div
          data-testid="verdict-pick-grid"
          style={{
            flex: 1,
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gridTemplateRows: 'repeat(3, 1fr)',
            gap: 6,
            minHeight: 0,
          }}
        >
          {orderedRows.map((row) => (
            <PickCell key={row.fighter} row={row} />
          ))}
        </div>

        {/* Bottom — stats lockup + optional kicker. */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div
            data-testid="verdict-stats"
            className="nb-mono"
            style={{
              fontSize: 11,
              letterSpacing: '0.16em',
              color: 'var(--nb-bone)',
              textAlign: 'center',
              background: 'rgba(0,0,0,0.55)',
              border: '1px solid rgba(255,255,255,0.18)',
              padding: '8px 10px',
            }}
          >
            {result.oldPicks}/9 OLD · {result.newPicks}/9 NEW
            {result.defied !== null && (
              <>
                {' '}
                · <span style={{ color: 'var(--nb-red)' }}>{result.defied}/9 CONTRARIAN</span>
              </>
            )}
          </div>

          {kicker !== null && (
            <div
              data-testid="verdict-kicker"
              className="nb-display nb-condensed"
              style={{
                fontSize: 13,
                lineHeight: 1.05,
                letterSpacing: '0.05em',
                color: 'var(--nb-red)',
                textAlign: 'center',
                textShadow: '0 0 12px oklch(0.55 0.24 27 / 0.5)',
              }}
            >
              {kicker}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
