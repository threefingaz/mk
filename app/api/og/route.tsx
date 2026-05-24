// GET /api/og — per-result preview image (Task 29).
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
// Layout (per design handoff §8):
//   Left 56%  — identity slab on .era-new background. Vertical brandmark,
//               archetype name (~56px condensed), blurb, stats lockup
//               (oldPicks/9 OLD · newPicks/9 NEW · defied/9 CONTRARIAN).
//   Right 44% — hero diptych. Two side-by-side mini-cells. Picked side fully
//               lit, other dimmed (opacity 0.4 + grayscale). Vertical seam at
//               (oldPicks/9 * 100%) from the left of the diptych; a thin red
//               contrarian-needle line sits at that x position.
//
// Fonts (v1): system sans-serif and serif placeholders. The visual structure
// matches the in-app card but the type doesn't exactly match Oswald/Inter.
// v1.5 plan: subset Oswald + Inter binaries fetched at edge cold-start.
//
// Constraints of @vercel/og JSX (Satori):
//   - inline styles only (no className, no CSS variables, no globals.css)
//   - no animations, no filter chains, limited CSS subset
//   - root must be a <div>, not a fragment
// Every color from styles.css is approximated to its hex equivalent below.

import { ImageResponse } from '@vercel/og';
import { decodeShareCode } from '@/lib/share-code';
import { FIGHTERS } from '@/lib/fighters';
import { archetypeFor } from '@/lib/archetype';
import {
  CANONICAL_ORDER,
  computeRunResult,
  SHARED_RESULT_RUN_ID,
  todayUtc,
} from '@/lib/run-result';
import type { RunResult } from '@/lib/run-result';
import { getCounts, isUnlocked } from '@/lib/kv';

export const runtime = 'edge';

// OKLCH → approximate hex (judgement calls from styles.css OKLCH values).
const COLORS = {
  // Old era
  obBone: '#e6dfc5',
  obInk: '#1f110d',
  obGold: '#c89c2a',
  // New era
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

  return new ImageResponse(<OgCard result={result} />, {
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

function OgCard({ result }: { result: RunResult }) {
  const arch = archetypeFor(result.oldPicks);
  const leanPct = (result.oldPicks / 9) * 100;

  // Hero pick selection. Find the first contrarian pick (choice != majority).
  // If none (n1 mode, or perfectly aligned with the crowd), use the first pick.
  let heroIdx = 0;
  if (result.defied !== null) {
    const contrarian = result.picks.findIndex(
      (p) => p.majority !== null && p.choice !== p.majority,
    );
    if (contrarian >= 0) {
      heroIdx = contrarian;
    }
  }
  const heroRow = result.picks[heroIdx];
  const heroFighter = FIGHTERS.find((f) => f.id === heroRow.fighter)!;
  const pickedOld = heroRow.choice === 'old';

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'row',
        background: '#000',
        color: COLORS.nbBone,
        fontFamily: 'sans-serif',
      }}
    >
      {/* LEFT — identity slab (56%) on era-new background */}
      <div
        style={{
          width: '56%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          padding: '48px 56px',
          background: COLORS.nbInk,
          color: COLORS.nbBone,
          borderRight: `1px solid ${COLORS.nbLine}`,
          boxSizing: 'border-box',
        }}
      >
        {/* Top: inline vertical brandmark (recreated; @vercel/og can't read
            globals.css). Two stacked cells split at a hairline. */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignSelf: 'flex-start',
            border: `1px solid ${COLORS.nbLine}`,
            padding: 0,
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
              borderTop: `1px solid ${COLORS.nbLine}`,
            }}
          >
            NEW BLOOD
          </div>
        </div>

        {/* Spacer */}
        <div style={{ flex: 1, display: 'flex' }} />

        {/* Middle: archetype name (mock-Oswald: bold, condensed letter-spacing) */}
        <div
          style={{
            fontSize: 92,
            lineHeight: 1.0,
            fontWeight: 800,
            letterSpacing: '-0.02em',
            color: COLORS.nbBone,
            textTransform: 'uppercase',
            display: 'flex',
          }}
        >
          {arch.name}
        </div>

        {/* Blurb (mock-Inter) */}
        <div
          style={{
            marginTop: 18,
            fontSize: 26,
            lineHeight: 1.35,
            color: COLORS.nbMute,
            maxWidth: 560,
            display: 'flex',
          }}
        >
          {arch.blurb}
        </div>

        {/* Spacer */}
        <div style={{ flex: 1, display: 'flex' }} />

        {/* Stats lockup */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'row',
            alignItems: 'center',
            gap: 18,
            fontSize: 22,
            letterSpacing: '0.14em',
            color: COLORS.nbBone,
            fontWeight: 700,
            textTransform: 'uppercase',
          }}
        >
          <span style={{ color: COLORS.obGold }}>{result.oldPicks}/9 OLD</span>
          <span style={{ color: COLORS.nbMute }}>·</span>
          <span style={{ color: COLORS.nbRed }}>{result.newPicks}/9 NEW</span>
          {result.defied !== null && (
            <>
              <span style={{ color: COLORS.nbMute }}>·</span>
              <span style={{ color: COLORS.nbRed }}>{result.defied}/9 CONTRARIAN</span>
            </>
          )}
        </div>

        {/* Tiny footer: date stamp */}
        <div
          style={{
            marginTop: 16,
            fontSize: 14,
            letterSpacing: '0.3em',
            color: COLORS.nbMute,
            fontFamily: 'monospace',
            display: 'flex',
          }}
        >
          {result.date}
        </div>
      </div>

      {/* RIGHT — hero diptych (44%) */}
      <div
        style={{
          width: '44%',
          height: '100%',
          position: 'relative',
          display: 'flex',
          flexDirection: 'row',
          background: '#000',
        }}
      >
        {/* OLD half */}
        <div
          style={{
            width: '50%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'flex-end',
            padding: '32px 24px',
            background: COLORS.obInk,
            color: COLORS.obBone,
            opacity: pickedOld ? 1 : 0.4,
            filter: pickedOld ? 'none' : 'grayscale(100%)',
            boxSizing: 'border-box',
          }}
        >
          <SilhouetteFill color={COLORS.obBone} />
          <div
            style={{
              fontSize: 13,
              letterSpacing: '0.32em',
              color: COLORS.obGold,
              fontFamily: 'monospace',
              display: 'flex',
            }}
          >
            1995
          </div>
          <div
            style={{
              marginTop: 6,
              fontSize: 28,
              lineHeight: 1.05,
              fontWeight: 800,
              textTransform: 'uppercase',
              color: COLORS.obBone,
              fontFamily: 'serif',
              display: 'flex',
            }}
          >
            {heroFighter.name}
          </div>
          <div
            style={{
              marginTop: 4,
              fontSize: 18,
              color: COLORS.obBone,
              opacity: 0.75,
              display: 'flex',
            }}
          >
            {heroFighter.oldActor}
          </div>
        </div>

        {/* NEW half */}
        <div
          style={{
            width: '50%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'flex-end',
            padding: '32px 24px',
            background: COLORS.nbInk2,
            color: COLORS.nbBone,
            opacity: pickedOld ? 0.4 : 1,
            filter: pickedOld ? 'grayscale(100%)' : 'none',
            boxSizing: 'border-box',
          }}
        >
          <SilhouetteFill color={COLORS.nbBone} />
          <div
            style={{
              fontSize: 13,
              letterSpacing: '0.32em',
              color: COLORS.nbRed,
              fontFamily: 'monospace',
              display: 'flex',
            }}
          >
            2026
          </div>
          <div
            style={{
              marginTop: 6,
              fontSize: 28,
              lineHeight: 1.05,
              fontWeight: 800,
              textTransform: 'uppercase',
              color: COLORS.nbBone,
              fontFamily: 'sans-serif',
              display: 'flex',
            }}
          >
            {heroFighter.name}
          </div>
          <div
            style={{
              marginTop: 4,
              fontSize: 18,
              color: COLORS.nbBone,
              opacity: 0.75,
              display: 'flex',
            }}
          >
            {heroFighter.newActor}
          </div>
        </div>

        {/* Vertical seam split at the user's overall lean. This sits on top
            of the two halves at the (oldPicks/9 * 100%) x-position of the
            diptych. A thin red contrarian-needle line. */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            left: `${leanPct}%`,
            width: 3,
            background: COLORS.nbRed,
            boxShadow: `0 0 18px ${COLORS.nbRed}`,
          }}
        />
      </div>
    </div>
  );
}

// Tall silhouette placeholder for the hero diptych. The real curated
// portraits aren't available in the edge runtime as URLs we can rely on,
// so the OG card uses a simple geometric silhouette block that reads as
// "figure" at the unfurl thumbnail size. Matches the in-app Silhouette
// fallback's role.
function SilhouetteFill({ color }: { color: string }) {
  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
        marginBottom: 12,
      }}
    >
      <div
        style={{
          width: 120,
          height: 220,
          background: color,
          opacity: 0.18,
          borderRadius: '60px 60px 8px 8px',
          display: 'flex',
        }}
      />
    </div>
  );
}
