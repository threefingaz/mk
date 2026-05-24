'use client';

// ShareSheetScreen — post-verdict sharing surface (Task 14 + Task 30).
// Ported from design_handoff_old_blood_new_blood/design-reference/src/screens.jsx
// (function ShareSheetScreen, ~lines 363-404).
//
// Production deltas vs prototype:
//   - Centered <VerdictCard result={...} /> at top, re-deriving the result via
//     computeRunResult() (same pattern as Verdict.tsx) — memoized.
//   - Dominant-era background skin (era-old / era-new), keyed off oldPicks >= 5.
//     The prototype hardcoded era-new.
//   - Copy Link / Native Share / Download Image / X / Instagram / TikTok all
//     wired to real /r/<short-code> URLs + /api/og fetches (Task 30). Share URL
//     is computed lazily inside each handler so window access is event-bound
//     (no SSR concerns).
//   - Native Share button is HIDDEN (not disabled) when navigator.share is
//     unavailable — feature-detected post-hydration via useHydrated() so SSR
//     + the first client render both see false (no hydration mismatch).
//   - X / Twitter opens a Tweet intent; Instagram / TikTok have no web-share
//     intent, so they fall back to copying the link and showing a tailored toast.
//   - No RUN AGAIN per Q2 (one run per browser, no replays).
//   - BACK link transitions phase: share → verdict via the new
//     goBackToVerdict() store action.

import { useEffect, useMemo, useState } from 'react';
import { VerdictCard } from '@/components/VerdictCard';
import { useRunStore } from '@/lib/store';
import { computeRunResult, dominantEraClass } from '@/lib/run-result';
import { buildCanonicalPicks, encodeShareCode } from '@/lib/share-code';
import { useHydrated } from '@/hooks/useHydrated';
import { trackEvent } from '@/lib/analytics';

export function Share() {
  const picks = useRunStore((s) => s.picks);
  const order = useRunStore((s) => s.order);
  const runId = useRunStore((s) => s.runId);
  const crowdStats = useRunStore((s) => s.crowdStats);
  const scoreboardUnlocked = useRunStore((s) => s.scoreboardUnlocked);
  const goBackToVerdict = useRunStore((s) => s.goBackToVerdict);

  // Same memoization pattern as Verdict.tsx — pure derivation over store state.
  const result = useMemo(
    () =>
      computeRunResult({
        picks,
        order,
        crowdStats,
        runId,
        unlocked: scoreboardUnlocked,
      }),
    [picks, order, crowdStats, runId, scoreboardUnlocked],
  );

  const dominant = dominantEraClass(result.oldPicks);

  // Feature-detect navigator.share post-mount. SSR returns false (default
  // state); after `hydrated` flips true we re-evaluate against the real
  // navigator on the client.
  const hydrated = useHydrated();
  const canNativeShare =
    hydrated && typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  // Fire share_open once on mount (Task 17b).
  useEffect(() => {
    trackEvent({ name: 'share_open' });
  }, []);

  // Brief toast confirmation after Copy Link / IG / TikTok fall-throughs.
  // Message varies so the user knows where to paste — IG/TikTok don't have a
  // web-share intent, so we copy the link and tell them to paste manually.
  const [toast, setToast] = useState<string | null>(null);
  useEffect(() => {
    if (toast === null) return;
    const id = setTimeout(() => setToast(null), 1800);
    return () => clearTimeout(id);
  }, [toast]);

  const shareTitle = 'OLD BLOOD // NEW BLOOD';
  const shareText = `My verdict: ${result.archetype.name}. ${result.archetype.blurb}`;

  // Lazy share URL builder — runs only inside event handlers so window access
  // is always event-bound (not render-time). encodeShareCode throws on invalid
  // input, but `picks` from the store is already constrained to ('old'|'new')[9]
  // at this point in the flow (Share screen is only reachable after 9 picks).
  // The canonical-order inversion lives in lib/share-code.ts next to the
  // encoder; see the comment there for the math.
  const buildShareUrl = (): string => {
    const code = encodeShareCode(buildCanonicalPicks(picks, order));
    return new URL(`/r/${code}`, window.location.origin).toString();
  };

  // Code used for /api/og?code=... downloads. Computed lazily inside the
  // handler — encoding 9 bits is microseconds; the prior useMemo was overkill.
  const computeShareCode = (): string => {
    try {
      return encodeShareCode(buildCanonicalPicks(picks, order));
    } catch {
      return '';
    }
  };

  const handleCopyLink = async () => {
    trackEvent({ name: 'share_click', props: { method: 'copy' } });
    try {
      const url = buildShareUrl();
      await navigator.clipboard.writeText(url);
      setToast('LINK COPIED');
    } catch {
      // Silent per Q7. Worst case the user sees no toast — better than an
      // error dialog over a non-critical action.
    }
  };

  const handleNativeShare = async () => {
    if (typeof navigator === 'undefined' || typeof navigator.share !== 'function') return;
    trackEvent({ name: 'share_click', props: { method: 'native' } });
    try {
      const url = buildShareUrl();
      await navigator.share({
        url,
        title: shareTitle,
        text: shareText,
      });
    } catch {
      // User cancelled, or platform rejected — both silent.
    }
  };

  const handleDownloadImage = async () => {
    trackEvent({ name: 'share_click', props: { method: 'download' } });
    try {
      const shareCode = computeShareCode();
      if (!shareCode) return;
      const ogUrl = `/api/og?code=${encodeURIComponent(shareCode)}`;
      const res = await fetch(ogUrl);
      if (!res.ok) return;
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objectUrl;
      a.download = 'old-blood-new-blood.png';
      // Some browsers require the anchor to be in the DOM for the click to
      // dispatch reliably; defensive append+remove.
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    } catch {
      // Silent per Q7 — non-critical action.
    }
  };

  const handlePlatformShare = (platform: 'x' | 'instagram' | 'tiktok') => {
    trackEvent({ name: 'share_click', props: { method: platform } });
    try {
      const url = buildShareUrl();
      if (platform === 'x') {
        // X / Twitter — open intent URL in a new tab. Pre-fills tweet text +
        // the share URL; user can edit before posting.
        const intent =
          'https://twitter.com/intent/tweet' +
          `?url=${encodeURIComponent(url)}` +
          `&text=${encodeURIComponent(shareText)}`;
        window.open(intent, '_blank', 'noopener,noreferrer');
        return;
      }
      // Instagram + TikTok don't expose a web-share intent. Fall back to copy
      // + a tailored toast so the user knows where to paste.
      void navigator.clipboard.writeText(url).then(
        () => {
          setToast(
            platform === 'instagram'
              ? 'LINK COPIED — PASTE INTO INSTAGRAM'
              : 'LINK COPIED — PASTE INTO TIKTOK',
          );
        },
        () => {
          // Clipboard failed — silent per Q7.
        },
      );
    } catch {
      // Silent per Q7.
    }
  };

  return (
    <div
      data-testid="share-screen"
      className={dominant}
      style={{
        position: 'relative',
        width: '100%',
        minHeight: '100vh',
        background: '#000',
      }}
    >
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
        {/* Header — BACK link + reveal title. */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <button
            type="button"
            className="nb-mono"
            onClick={() => goBackToVerdict()}
            data-testid="share-back"
            style={{
              background: 'transparent',
              border: 0,
              color: 'var(--nb-mute)',
              fontSize: 'clamp(11px, 1.1vw, 13px)',
              letterSpacing: '0.18em',
              cursor: 'pointer',
              padding: 0,
            }}
          >
            ← BACK
          </button>
          <div style={{ width: 56 }} />
        </div>

        <div style={{ textAlign: 'center' }}>
          <div
            className="nb-mono"
            style={{
              fontSize: 'clamp(10px, 1.1vw, 13px)',
              letterSpacing: '0.3em',
              color: 'var(--nb-mute)',
            }}
          >
            YOUR VERDICT IS READY
          </div>
          <div
            className="nb-display nb-condensed"
            style={{
              fontSize: 'clamp(24px, 3vw, 40px)',
              lineHeight: 1,
              color: 'var(--nb-bone)',
              marginTop: 4,
            }}
          >
            POST IT. STAKE YOUR FLAG.
          </div>
        </div>

        {/* Centered verdict card preview. The cqw-based VerdictCard type
            scales with the stage width — bumping the cap on desktop scales
            the whole card up. Matches Verdict.tsx's stage sizing for
            visual consistency across the two screens. */}
        <div
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div
            data-testid="share-card-stage"
            style={{
              width: 'var(--card-stage-w-sm)',
              boxShadow:
                '0 24px 60px -10px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.08)',
              containerType: 'inline-size',
            }}
          >
            <VerdictCard result={result} />
          </div>
        </div>

        {/* Primary share row — Copy Link + Download Image. Native Share
            takes the place of Copy Link when supported (mobile / PWA). */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 'clamp(10px, 1.2vw, 16px)',
          }}
        >
          {canNativeShare ? (
            <button
              type="button"
              className="btn-new btn-new-red share-button-native"
              onClick={handleNativeShare}
              data-testid="share-native"
              style={{
                fontSize: 'clamp(13px, 1.4vw, 16px)',
                padding: 'clamp(14px, 1.6vw, 18px)',
                justifyContent: 'center',
                textAlign: 'center',
              }}
            >
              SHARE ↗
            </button>
          ) : (
            <button
              type="button"
              className="btn-new btn-new-red"
              onClick={handleCopyLink}
              data-testid="share-copy"
              style={{
                fontSize: 'clamp(13px, 1.4vw, 16px)',
                padding: 'clamp(14px, 1.6vw, 18px)',
                justifyContent: 'center',
                textAlign: 'center',
              }}
            >
              COPY LINK
            </button>
          )}
          <button
            type="button"
            className="btn-new"
            onClick={handleDownloadImage}
            data-testid="share-download"
            style={{
              fontSize: 'clamp(13px, 1.4vw, 16px)',
              padding: 'clamp(14px, 1.6vw, 18px)',
              justifyContent: 'center',
              textAlign: 'center',
            }}
          >
            SAVE IMAGE ↓
          </button>
        </div>

        {/* Secondary share row — if native share is available, surface Copy
            Link as a quiet text-only fallback (matches prototype). */}
        {canNativeShare ? (
          <div style={{ display: 'flex', justifyContent: 'center', gap: 14, marginTop: -4 }}>
            <button
              type="button"
              className="nb-mono"
              onClick={handleCopyLink}
              data-testid="share-copy-secondary"
              style={{
                background: 'transparent',
                border: 0,
                color: 'var(--nb-mute)',
                fontSize: 'clamp(10px, 1vw, 12px)',
                letterSpacing: '0.18em',
                cursor: 'pointer',
                padding: 0,
              }}
            >
              COPY LINK
            </button>
          </div>
        ) : null}

        {/* Platform-specific row — no-op placeholders for Phase 1. */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr 1fr',
            gap: 'clamp(8px, 1vw, 14px)',
          }}
        >
          <button
            type="button"
            className="btn-new"
            onClick={() => handlePlatformShare('x')}
            data-testid="share-platform-x"
            style={{
              fontSize: 'clamp(11px, 1.2vw, 14px)',
              padding: 'clamp(10px, 1.2vw, 14px)',
              justifyContent: 'center',
              textAlign: 'center',
            }}
          >
            X / TWITTER
          </button>
          <button
            type="button"
            className="btn-new"
            onClick={() => handlePlatformShare('instagram')}
            data-testid="share-platform-instagram"
            style={{
              fontSize: 'clamp(11px, 1.2vw, 14px)',
              padding: 'clamp(10px, 1.2vw, 14px)',
              justifyContent: 'center',
              textAlign: 'center',
            }}
          >
            INSTAGRAM
          </button>
          <button
            type="button"
            className="btn-new"
            onClick={() => handlePlatformShare('tiktok')}
            data-testid="share-platform-tiktok"
            style={{
              fontSize: 'clamp(11px, 1.2vw, 14px)',
              padding: 'clamp(10px, 1.2vw, 14px)',
              justifyContent: 'center',
              textAlign: 'center',
            }}
          >
            TIKTOK
          </button>
        </div>

        {/* Toast — fades in after Copy Link / IG / TikTok fall-throughs,
            auto-clears after 1.8s. Message is dynamic per source (see handlers). */}
        {toast !== null ? (
          <div
            role="status"
            aria-live="polite"
            data-testid="share-copied-toast"
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
    </div>
  );
}
