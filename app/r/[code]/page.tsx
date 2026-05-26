// /r/[code] — friend's verdict result page (Task 28).
//
// Server component. Decodes the share code on the server, fetches live crowd
// stats from KV directly (no extra HTTP hop to /api/results), computes a
// synthetic RunResult, and renders the verdict card + a single PLAY YOURSELF
// CTA. A tiny client island (RViewTracker) fires the `r_view` analytics event
// on mount.
//
// Auto-upgrade behavior (per Q5): the page reads live `unlocked` + `stats` on
// every request — a code shared pre-unlock renders in n1 mode while the board
// is still locked, and the same code renders in `unlocked` mode (with a live
// `defied` count) once the board flips. No client special-casing — this falls
// out of "decode picks from URL, read live crowd state on every request."
//
// Why server? The decode is cheap, the metadata is server-driven (OG unfurl
// needs the resolved archetype name in the <head>), and KV reads happen on the
// server anyway. The card itself is a client component because of `useTilt` —
// React 19 allows client components under server components without any
// special wrapping.
//
// Bad codes → notFound() (404). The card is the entire purpose of the page;
// rendering a friendly error would only mislead.
//
// generateMetadata: decoding failure here falls back to default metadata
// rather than 404 because the metadata is invoked for OG unfurls by social
// platforms; the page handler will still 404 the request — the metadata
// fallback just ensures we surface sensible default tags on the way out.

import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { DisclaimerRibbon } from '@/components/DisclaimerRibbon';
import { VerdictCard } from '@/components/VerdictCard';
import { decodeShareCode } from '@/lib/share-code';
import { archetypeFor } from '@/lib/archetype';
import {
  CANONICAL_ORDER,
  computeRunResult,
  dominantEraClass,
  SHARED_RESULT_RUN_ID,
  todayUtc,
} from '@/lib/run-result';
import { getCounts, isUnlocked } from '@/lib/kv';
import { RViewTracker } from './RViewTracker';

type PageParams = { code: string };

/**
 * Base URL for absolute OG image links. Vercel sets VERCEL_URL to the host
 * (no protocol); local dev uses localhost. Social platforms require absolute
 * URLs in OG image tags.
 */
function getBaseUrl(): string {
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  return 'http://localhost:3000';
}

export async function generateMetadata({
  params,
}: {
  params: Promise<PageParams>;
}): Promise<Metadata> {
  const { code } = await params;

  // Default fallback metadata — used when the code is malformed. The page
  // handler will 404 such requests, but social-platform crawlers still benefit
  // from sensible default OG tags.
  const defaultTitle = 'OLD BLOOD // NEW BLOOD';
  const defaultDescription =
    '9 head-to-head duels between the 1995 Mortal Kombat cast and the 2026 reboot. Pick your side.';

  let archetypeName = defaultTitle;

  try {
    const picks = decodeShareCode(code);
    const oldPicks = picks.filter((p) => p === 'old').length;
    const arch = archetypeFor(oldPicks);
    archetypeName = arch.name;
  } catch {
    // Decode failure — fall through with default metadata. The page handler
    // will 404 the request.
  }

  const title = `OLD BLOOD // NEW BLOOD · ${archetypeName}`;
  const description = defaultDescription;
  const ogUrl = `${getBaseUrl()}/api/og?code=${encodeURIComponent(code)}`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: [{ url: ogUrl, width: 1200, height: 630 }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [ogUrl],
    },
  };
}

export default async function ResultPage({ params }: { params: Promise<PageParams> }) {
  const { code } = await params;

  // Decode — bad codes → 404.
  let picks;
  try {
    picks = decodeShareCode(code);
  } catch {
    notFound();
  }

  // Live crowd state read. isUnlocked() and getCounts() are server-safe and
  // read directly from KV (in-memory mock in dev). On any KV throw this whole
  // page would 500 — acceptable for now; the resilience client only wraps the
  // browser → /api/results path. KV reads in a server component are treated
  // as infrastructure.
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

  // Dominant-era background skin — matches Verdict.tsx's behavior so the
  // /r/[code] view feels like the same artifact, not a separate page.
  const dominant = dominantEraClass(result.oldPicks);

  return (
    <main
      data-testid="r-result-page"
      className={dominant}
      style={{
        position: 'relative',
        width: '100%',
        minHeight: '100vh',
        background: '#000',
        overflow: 'hidden',
      }}
    >
      {/* Spotlight glow matching Verdict.tsx — preserves the "verdict moment"
          feel for the visitor opening their friend's share link. */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'radial-gradient(ellipse at 50% 30%, oklch(0.40 0.20 27 / 0.35), transparent 60%)',
          pointerEvents: 'none',
        }}
      />

      <div
        className="content-column"
        style={{
          position: 'relative',
          zIndex: 4,
          // Padding/gap come from the `.content-column` rule's CSS custom
          // properties so the four long-form screens stay in sync.
          padding: 'var(--col-pad-y-top) var(--col-pad-x) var(--col-pad-y-bot)',
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--col-gap)',
        }}
      >
        {/* Header — matches Verdict.tsx framing but with "A FRIEND'S VERDICT"
            so the visitor reads the page as someone else's artifact. */}
        <div style={{ textAlign: 'center' }}>
          <div
            className="nb-mono"
            style={{
              fontSize: 'clamp(9px, 1.2vw, 12px)',
              letterSpacing: '0.4em',
              color: 'var(--nb-red)',
            }}
          >
            ·  A FRIEND&apos;S VERDICT  ·
          </div>
          <div
            className="nb-display nb-condensed"
            style={{
              fontSize: 'clamp(14px, 1.8vw, 20px)',
              color: 'var(--nb-mute)',
              marginTop: 4,
              letterSpacing: '0.18em',
            }}
          >
            9 OF 9 SETTLED
          </div>
        </div>

        {/* Card stage. Same scaling box as Verdict.tsx so the card composes
            identically — same aspect ratio, same containerType for cqw fluid
            type, same shadow lockup. */}
        <div
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div
            data-testid="r-result-card-stage"
            style={{
              width: 'var(--card-stage-w)',
              boxShadow:
                '0 30px 80px -10px oklch(0.45 0.22 27 / 0.5), 0 0 0 1px rgba(255,255,255,0.08)',
              containerType: 'inline-size',
            }}
          >
            <VerdictCard result={result} />
          </div>
        </div>

        {/* Single CTA per Q4: PLAY YOURSELF → starts a fresh run for the
            visitor. No compare layer, no replay-friend's-picks. */}
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <Link
            href="/"
            data-testid="r-play-yourself"
            className="btn-new btn-new-red"
            style={{
              fontSize: 'clamp(14px, 1.6vw, 18px)',
              padding: 'clamp(14px, 1.8vw, 20px) clamp(28px, 3.5vw, 44px)',
              justifyContent: 'center',
              textAlign: 'center',
              textDecoration: 'none',
              display: 'inline-flex',
              alignItems: 'center',
            }}
          >
            PLAY YOURSELF →
          </Link>
        </div>
      </div>

      <DisclaimerRibbon />

      {/* Client island: fires the r_view analytics event on mount. */}
      <RViewTracker />
    </main>
  );
}
