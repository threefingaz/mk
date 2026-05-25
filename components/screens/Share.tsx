'use client';

// ShareSheetScreen — post-verdict sharing surface.
//
// Two actions only: COPY LINK + SAVE IMAGE. Native share and platform-specific
// buttons (X / Instagram / TikTok) were removed by product call — sharing is
// platform-agnostic: a friend gets a /r/<code> URL with an unfurl image, the
// user pastes wherever they want.
//
// Share URL is computed lazily inside each handler so window access is
// event-bound (no SSR concerns). BACK link transitions phase: share → verdict
// via the goBackToVerdict() store action.

import { useEffect, useMemo, useState } from 'react';
import { VerdictCard } from '@/components/VerdictCard';
import { useRunStore } from '@/lib/store';
import { computeRunResult, dominantEraClass } from '@/lib/run-result';
import { buildCanonicalPicks, encodeShareCode } from '@/lib/share-code';
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

  useEffect(() => {
    trackEvent({ name: 'share_open' });
  }, []);

  const [toast, setToast] = useState<string | null>(null);
  useEffect(() => {
    if (toast === null) return;
    const id = setTimeout(() => setToast(null), 1800);
    return () => clearTimeout(id);
  }, [toast]);

  const buildShareUrl = (): string => {
    const code = encodeShareCode(buildCanonicalPicks(picks, order));
    return new URL(`/r/${code}`, window.location.origin).toString();
  };

  const handleCopyLink = async () => {
    trackEvent({ name: 'share_click', props: { method: 'copy' } });
    try {
      const url = buildShareUrl();
      await navigator.clipboard.writeText(url);
      setToast('LINK COPIED');
    } catch {
      // Silent per Q7.
    }
  };

  const handleDownloadImage = async () => {
    trackEvent({ name: 'share_click', props: { method: 'download' } });
    try {
      const code = encodeShareCode(buildCanonicalPicks(picks, order));
      const res = await fetch(`/api/og?code=${encodeURIComponent(code)}`);
      if (!res.ok) return;
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objectUrl;
      a.download = 'old-blood-new-blood.png';
      // Some browsers require the anchor to be in the DOM for the click to dispatch.
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
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

        {/* Share actions — COPY LINK + SAVE IMAGE. */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 'clamp(10px, 1.2vw, 16px)',
          }}
        >
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

        {/* Toast — fades in after COPY LINK, auto-clears after 1.8s. */}
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
