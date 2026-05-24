'use client';

// EraCard — portrait-optimized trading card.
// Structure: [top tag-strip band] · [portrait + era overlay + picked stamp] · [name band]
// Ported from design_handoff_old_blood_new_blood/design-reference/src/system.jsx (EraCard),
// with the prototype's <image-slot> drag-drop replaced by the production <Portrait> component.
//
// Four states ("class names" plan requirement):
//   idle         — interactive, no picked/dimmed modifiers
//   idle-filled  — equivalent to idle in this port (Portrait always renders)
//   picked       — adds .picked + renders the picked stamp overlay
//   dimmed       — adds .dimmed + inline opacity/grayscale to fade non-chosen cards
//
// `nameBandMode` controls the bottom band:
//   'full'  — character name + actor (standalone showcase)
//   'actor' — actor only (duel screens; character name anchored above the card)

import type { CSSProperties } from 'react';
import type { Era, Fighter } from '@/lib/fighters';
import { Portrait } from './Portrait';

type NameBandMode = 'full' | 'actor';

export type EraCardProps = {
  fighter: Fighter;
  era: Era;
  picked?: boolean;
  dimmed?: boolean;
  onPick?: () => void;
  nameBandMode?: NameBandMode;
  style?: CSSProperties;
};

export function EraCard({
  fighter,
  era,
  picked = false,
  dimmed = false,
  onPick,
  nameBandMode = 'full',
  style,
}: EraCardProps) {
  const isOld = era === 'old';
  const tag = isOld ? fighter.oldTag : fighter.newTag;
  const actor = isOld ? fighter.oldActor : fighter.newActor;

  const showCharacter = nameBandMode === 'full';
  const showActor = nameBandMode === 'full' || nameBandMode === 'actor';

  const classNames = [
    'fighter-card',
    `fighter-card-${era}`,
    picked ? 'picked' : null,
    dimmed ? 'dimmed' : null,
  ]
    .filter(Boolean)
    .join(' ');

  // ── top tag strip (era + year) ────────────────────────────────────────────
  const topBand = isOld ? (
    <div
      className="fc-band-top tag-strip ts-old"
      style={{
        background: 'var(--ob-bone)',
        color: 'var(--ob-ink)',
        borderBottom: '2px solid var(--ob-ink)',
      }}
    >
      <span className="ob-mono" style={{ fontSize: 12, letterSpacing: '0.05em', lineHeight: 1 }}>
        {tag}
      </span>
      <span className="ob-display" style={{ fontSize: 11, color: 'var(--ob-blood)', lineHeight: 1 }}>
        1995
      </span>
    </div>
  ) : (
    <div
      className="fc-band-top tag-strip ts-new"
      style={{
        background: 'var(--nb-ink)',
        color: 'var(--nb-bone)',
        borderBottom: '1px solid var(--nb-line)',
      }}
    >
      <span
        className="nb-mono"
        style={{ fontSize: 9, letterSpacing: '0.18em', color: 'var(--nb-mute)' }}
      >
        {tag}
      </span>
      <span
        className="nb-display nb-condensed"
        style={{ fontSize: 11, color: 'var(--nb-red)', letterSpacing: '0.18em' }}
      >
        2026
      </span>
    </div>
  );

  // ── era-treatment overlay (compositing layer over the portrait) ──────────
  const overlay = (
    <div className={`fc-overlay ${isOld ? 'fc-overlay-old' : 'fc-overlay-new'}`}>
      {isOld && <div className="fc-tracking" />}
      {isOld && <div className="fc-chromabar" />}
      {!isOld && <div className="fc-grid-new" />}
      {!isOld && <div className="fc-lightning" />}
    </div>
  );

  // ── picked-state stamp (renders only when picked) ────────────────────────
  const pickedStamp = picked ? (
    <div
      className="picked-stamp"
      data-testid="picked-stamp"
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 4,
        background: isOld
          ? 'linear-gradient(180deg, oklch(0.55 0.25 340 / 0.35), oklch(0.50 0.22 25 / 0.45))'
          : 'linear-gradient(180deg, transparent 30%, oklch(0.45 0.22 27 / 0.55) 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        mixBlendMode: isOld ? 'screen' : 'normal',
        pointerEvents: 'none',
      }}
    >
      <div
        className={isOld ? 'ob-display ob-chromatic' : 'nb-display nb-condensed'}
        style={{
          fontSize: isOld ? 24 : 28,
          color: isOld ? 'var(--ob-bone)' : 'var(--nb-bone)',
          letterSpacing: isOld ? '0.05em' : '0.12em',
          transform: isOld ? 'rotate(-4deg)' : 'none',
          border: isOld ? '3px solid var(--ob-bone)' : '1.5px solid var(--nb-bone)',
          padding: isOld ? '6px 14px 2px' : '8px 16px',
          background: isOld ? 'transparent' : 'rgba(0,0,0,0.35)',
          backdropFilter: isOld ? 'none' : 'blur(4px)',
        }}
      >
        PICKED
      </div>
    </div>
  ) : null;

  // ── bottom name band ──────────────────────────────────────────────────────
  const nameBand: React.ReactNode = isOld ? (
      <div
        className="fc-band-bot"
        data-testid="name-band"
        style={{
          background: 'var(--ob-bone)',
          color: 'var(--ob-ink)',
          borderTop: '2px solid var(--ob-ink)',
          boxShadow: 'inset 0 -3px 0 var(--ob-magenta), inset 0 -6px 0 var(--ob-ink)',
        }}
      >
        {showCharacter && (
          <div
            className="ob-display ob-chromatic"
            style={{
              fontSize: 16,
              lineHeight: 1,
              color: 'var(--ob-ink)',
              textShadow: '1px 0 0 var(--ob-magenta), -1px 0 0 var(--ob-cyan)',
            }}
          >
            {fighter.name.toUpperCase()}
          </div>
        )}
        {showActor && actor && (
          <div
            className="ob-mono"
            style={{
              fontSize: showCharacter ? 12 : 15,
              color: showCharacter ? 'var(--ob-blood)' : 'var(--ob-ink)',
              marginTop: showCharacter ? 3 : 0,
              letterSpacing: '0.02em',
              lineHeight: 1.05,
              fontWeight: showCharacter ? 400 : 700,
            }}
          >
            {actor}
          </div>
        )}
      </div>
    ) : (
      <div
        className="fc-band-bot"
        data-testid="name-band"
        style={{
          background: 'var(--nb-ink)',
          color: 'var(--nb-bone)',
          borderTop: '1px solid var(--nb-line)',
          boxShadow: 'inset 0 -3px 0 var(--nb-red-2), inset 0 -5px 0 var(--nb-ink)',
        }}
      >
        {showCharacter && (
          <div
            className="nb-display nb-condensed"
            style={{ fontSize: 18, lineHeight: 1, letterSpacing: '0.01em' }}
          >
            {fighter.name.toUpperCase()}
          </div>
        )}
        {showActor && actor && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              marginTop: showCharacter ? 5 : 0,
            }}
          >
            <span
              style={{
                display: 'inline-block',
                width: 5,
                height: 5,
                background: 'var(--nb-red)',
                flexShrink: 0,
              }}
            />
            <span
              className={showCharacter ? 'nb-mono' : 'nb-display nb-condensed'}
              style={{
                fontSize: showCharacter ? 10 : 16,
                color: showCharacter ? 'var(--nb-mute)' : 'var(--nb-bone)',
                letterSpacing: showCharacter ? '0.04em' : '0.01em',
                lineHeight: 1,
              }}
            >
              {actor}
            </span>
          </div>
        )}
      </div>
    );

  // ── card chrome (button or div) ───────────────────────────────────────────
  const baseStyle: CSSProperties = {
    background: isOld ? 'var(--ob-bone)' : 'var(--nb-ink)',
    border: isOld ? '2px solid var(--ob-ink)' : '2px solid var(--nb-line)',
    boxShadow: isOld
      ? picked
        ? '3px 3px 0 var(--ob-ink), 6px 6px 0 var(--ob-magenta)'
        : '2px 2px 0 var(--ob-ink)'
      : picked
        ? '0 14px 36px -8px oklch(0.55 0.24 27 / 0.7), 0 0 0 1px var(--nb-red)'
        : '0 10px 36px -8px oklch(0.40 0.22 27 / 0.35), 0 4px 14px -4px rgba(0,0,0,0.6)',
    padding: 0,
    cursor: onPick ? 'pointer' : 'default',
    textAlign: 'left',
    color: 'inherit',
    borderRadius: '14px 14px 3px 3px',
    overflow: 'hidden',
    transition: 'box-shadow .15s, transform .15s, opacity .15s, filter .15s',
    ...(dimmed
      ? {
          opacity: 0.32,
          filter: 'grayscale(0.9) brightness(0.7)',
        }
      : null),
    ...style,
  };

  return (
    <button
      type="button"
      className={classNames}
      onClick={onPick}
      // When the card has no click handler (post-pick reveal state), drop it
      // out of the tab order so keyboard users don't focus a no-op control.
      // tabIndex=-1 rather than `disabled` so layout/auto-styling stays
      // identical to interactive cards (the design treats "picked" + "dimmed"
      // as a render state, not a button-disabled state).
      tabIndex={onPick ? 0 : -1}
      style={baseStyle}
      aria-pressed={picked || undefined}
    >
      {topBand}
      <div className="fc-portrait" style={{ position: 'relative' }}>
        <Portrait fighterId={fighter.id} era={era} silhouette={fighter.silhouette} />
        {overlay}
        {pickedStamp}
      </div>
      {nameBand}
    </button>
  );
}
