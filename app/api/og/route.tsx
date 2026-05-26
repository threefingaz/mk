// GET /api/og — per-result preview image.
//
// Edge runtime. Renders a 1200×630 PNG via @vercel/og's ImageResponse from a
// share code in the querystring. Used as the Open Graph image for /r/[code]
// pages so social platforms unfurl the friend's verdict card.
//
// Why edge: @vercel/og uses Satori (server-side JSX → SVG → PNG) which only
// runs on the edge runtime. It also keeps the unfurl path low-latency for
// Twitter / iMessage / Slack scrapers.
//
// Reads `isUnlocked()` + `getCounts()` directly from lib/kv on the edge.
// @vercel/kv is a thin wrapper around @upstash/redis (a `fetch`-based REST
// client) so it runs cleanly on the edge runtime.
//
// Layout mirrors the in-app VerdictCard so the share image and the artifact
// the player sees on the Share screen read as the same object:
//   Left  (~54%): brandmark, "YOU ARE" eyebrow, big archetype display,
//                 stats lockup, optional kicker, date.
//   Right (~46%): 3×3 portrait grid (one cell per fighter, era-themed per the
//                 player's choice; red ring on contrarian cells when unlocked).
// Dominant-era background fills the whole canvas (era-old when oldPicks >= 5,
// else era-new) — same as VerdictCard.
//
// Constraints of @vercel/og JSX (Satori): inline styles only, no className,
// no CSS variables, no globals.css, no animations, limited CSS subset. Every
// color from styles.css is approximated to its hex equivalent below.

import { ImageResponse } from '@vercel/og';
import { decodeShareCode } from '@/lib/share-code';
import { FIGHTERS, type FighterId } from '@/lib/fighters';
import { archetypeFor } from '@/lib/archetype';
import {
  CANONICAL_ORDER,
  computeRunResult,
  SHARED_RESULT_RUN_ID,
  todayUtc,
} from '@/lib/run-result';
import type { PickRow, RunResult } from '@/lib/run-result';
import { getCounts, isUnlocked } from '@/lib/kv';

export const runtime = 'edge';

// OKLCH → approximate hex (judgement calls from styles.css OKLCH values).
const COLORS = {
  obBone: '#e6dfc5',
  obInk: '#1f110d',
  obInk2: '#2a1812',
  obGold: '#c89c2a',
  nbInk: '#080d18',
  nbInk2: '#141a2a',
  nbBone: '#f5f5f8',
  nbMute: '#8389a1',
  nbLine: '#2e3447',
  nbRed: '#cb1f1f',
} as const;

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');

  if (!code) {
    return new Response('Missing code', { status: 400 });
  }

  let picks: ('old' | 'new')[];
  try {
    picks = decodeShareCode(code);
  } catch {
    return new Response('Bad code', { status: 400 });
  }

  // Live crowd state — read directly from KV on the edge. KV throws would
  // propagate (500); acceptable for this surface since OG images are
  // server-side rendered and social crawlers will retry.
  const unlocked = await isUnlocked();
  const stats = unlocked ? await getCounts() : null;

  const result = computeRunResult({
    picks,
    order: [...CANONICAL_ORDER],
    crowdStats: stats,
    unlocked,
    runId: SHARED_RESULT_RUN_ID,
    date: todayUtc(),
  });

  return new ImageResponse(<OgCard result={result} origin={url.origin} />, {
    width: 1200,
    height: 630,
    headers: {
      // Short s-maxage so pre-unlock shares auto-upgrade promptly once the
      // board flips (Q5). 5min keeps CDN efficient without stale verdict
      // cards lingering across unlock boundaries.
      'Cache-Control': 'public, max-age=3600, s-maxage=300',
    },
  });
}

// ---------------------------------------------------------------------------
// JSX layout. All inline styles; no className. Restricted CSS subset only.
// ---------------------------------------------------------------------------

function OgCard({ result, origin }: { result: RunResult; origin: string }) {
  const arch = archetypeFor(result.oldPicks);
  const dominantOld = result.oldPicks >= 5;

  // Sort pick rows back into FIGHTERS canonical order so the grid is stable
  // across runs — matches VerdictCard.
  const orderedRows: PickRow[] = FIGHTERS.map(
    (f) => result.picks.find((p) => p.fighter === (f.id as FighterId)) as PickRow,
  );

  const unlocked = result.defied !== null;
  const kicker = unlocked
    ? (result.defied ?? 0) > 0
      ? `YOU DEFIED THE CROWD ${result.defied} TIMES`
      : 'YOU MOVED WITH THE CROWD'
    : null;

  // Dominant-era surface colors — same logical role as the era-old / era-new
  // skins in app/globals.css.
  const skin = dominantOld
    ? {
        bg: COLORS.obInk,
        bgAlt: COLORS.obInk2,
        text: COLORS.obBone,
        mute: 'rgba(230, 223, 197, 0.65)',
        accent: COLORS.obGold,
        line: 'rgba(230, 223, 197, 0.18)',
        displayFamily: 'serif',
      }
    : {
        bg: COLORS.nbInk,
        bgAlt: COLORS.nbInk2,
        text: COLORS.nbBone,
        mute: COLORS.nbMute,
        accent: COLORS.nbRed,
        line: COLORS.nbLine,
        displayFamily: 'sans-serif',
      };

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'row',
        background: skin.bg,
        backgroundImage: `linear-gradient(135deg, ${skin.bg} 0%, ${skin.bgAlt} 100%)`,
        color: skin.text,
        fontFamily: 'sans-serif',
      }}
    >
      {/* LEFT — identity column (archetype + stats). */}
      <div
        style={{
          width: '54%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          padding: '48px 56px',
          boxSizing: 'border-box',
        }}
      >
        {/* Brandmark */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignSelf: 'flex-start',
            border: `1px solid ${skin.line}`,
          }}
        >
          <div
            style={{
              padding: '6px 14px',
              fontSize: 14,
              letterSpacing: '0.18em',
              color: COLORS.obBone,
              background: COLORS.obInk,
              fontWeight: 700,
              fontFamily: 'serif',
            }}
          >
            OLD BLOOD
          </div>
          <div
            style={{
              padding: '6px 14px',
              fontSize: 14,
              letterSpacing: '0.18em',
              color: COLORS.nbRed,
              fontWeight: 700,
              borderTop: `1px solid ${skin.line}`,
            }}
          >
            NEW BLOOD
          </div>
        </div>

        <div style={{ flex: 1, display: 'flex' }} />

        {/* "YOU ARE" eyebrow */}
        <div
          style={{
            fontSize: 16,
            letterSpacing: '0.3em',
            color: skin.mute,
            fontFamily: 'monospace',
            display: 'flex',
          }}
        >
          YOU ARE
        </div>

        {/* Archetype display name */}
        <div
          style={{
            marginTop: 10,
            fontSize: 92,
            lineHeight: 0.95,
            fontWeight: 800,
            letterSpacing: dominantOld ? '0.01em' : '-0.02em',
            color: skin.text,
            textTransform: 'uppercase',
            fontFamily: skin.displayFamily,
            display: 'flex',
          }}
        >
          {arch.name}
        </div>

        <div style={{ flex: 1, display: 'flex' }} />

        {/* Stats lockup — mirrors VerdictCard's stats bar */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'row',
            alignItems: 'center',
            gap: 14,
            fontSize: 20,
            letterSpacing: '0.14em',
            fontWeight: 700,
            textTransform: 'uppercase',
            padding: '10px 14px',
            background: 'rgba(0,0,0,0.45)',
            border: `1px solid ${skin.line}`,
            alignSelf: 'flex-start',
          }}
        >
          <span style={{ color: COLORS.obGold }}>{result.oldPicks}/9 OLD</span>
          <span style={{ color: skin.mute }}>·</span>
          <span style={{ color: COLORS.nbRed }}>{result.newPicks}/9 NEW</span>
          {result.defied !== null && (
            <>
              <span style={{ color: skin.mute }}>·</span>
              <span style={{ color: COLORS.nbRed }}>{result.defied}/9 CONTRARIAN</span>
            </>
          )}
        </div>

        {/* Kicker (unlocked only) + date row */}
        <div
          style={{
            marginTop: 14,
            display: 'flex',
            flexDirection: 'row',
            alignItems: 'center',
            gap: 16,
          }}
        >
          <div
            style={{
              fontSize: 13,
              letterSpacing: '0.3em',
              color: skin.mute,
              fontFamily: 'monospace',
              display: 'flex',
            }}
          >
            {result.date}
          </div>
          {kicker !== null && (
            <div
              style={{
                fontSize: 13,
                letterSpacing: '0.18em',
                color: COLORS.nbRed,
                fontWeight: 700,
                textTransform: 'uppercase',
                display: 'flex',
              }}
            >
              {kicker}
            </div>
          )}
        </div>
      </div>

      {/* RIGHT — 3×3 portrait grid mirroring the VerdictCard middle. */}
      <div
        style={{
          width: '46%',
          height: '100%',
          padding: '48px 56px 48px 0',
          boxSizing: 'border-box',
          display: 'flex',
        }}
      >
        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            flexWrap: 'wrap',
            gap: 8,
          }}
        >
          {orderedRows.map((row) => (
            <PickCell key={row.fighter} row={row} origin={origin} />
          ))}
        </div>
      </div>
    </div>
  );
}

// Cell sizing — Satori doesn't support calc(), so dimensions are pinned in
// pixels. Right column inner box is 1200×0.46 − 56 = 496px wide and
// 630 − 96 = 534px tall. Three cells with 8px gaps → 160×172 cells.
const CELL_W = 160;
const CELL_H = 172;

function PickCell({ row, origin }: { row: PickRow; origin: string }) {
  const era = row.choice;
  const isContrarian = row.majority !== null && row.choice !== row.majority;
  const portraitUrl = `${origin}/portraits/${row.fighter}-${era}.jpg`;
  const eraBg = era === 'old' ? COLORS.obInk : COLORS.nbInk;

  return (
    <div
      style={{
        width: CELL_W,
        height: CELL_H,
        position: 'relative',
        background: eraBg,
        overflow: 'hidden',
        display: 'flex',
        border: isContrarian ? `2px solid ${COLORS.nbRed}` : `1px solid rgba(255,255,255,0.08)`,
        boxSizing: 'border-box',
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- Satori only supports <img>; no next/image at edge. */}
      <img
        src={portraitUrl}
        alt=""
        width={CELL_W}
        height={CELL_H}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
        }}
      />
    </div>
  );
}
