'use client';

// ShareActions — COPY LINK + SAVE IMAGE button row with copy-toast.
//
// Used inline on Verdict (fresh completion) and ReturningVisitor (revisit).
// The Share screen was deleted when the share button set was trimmed to two
// actions; this component encapsulates both alongside any other CTAs that
// belong on the host screen.
//
// Takes `picks` + `order` directly as props so callers don't need to hydrate
// the run-store first (the prior approach for returning-visitor sharing).

import { useEffect, useState } from 'react';
import { buildCanonicalPicks, encodeShareCode } from '@/lib/share-code';
import { trackEvent } from '@/lib/analytics';
import type { Era } from '@/lib/fighters';

export function ShareActions({ picks, order }: { picks: Era[]; order: number[] }) {
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
      await navigator.clipboard.writeText(buildShareUrl());
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
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    } catch {
      // Silent per Q7.
    }
  };

  return (
    <>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 'clamp(10px, 1.5vw, 16px)',
        }}
      >
        <button
          type="button"
          className="btn-new btn-new-red"
          onClick={handleCopyLink}
          data-testid="share-copy"
          style={{
            fontSize: 'clamp(13px, 1.5vw, 17px)',
            padding: 'clamp(14px, 1.8vw, 20px)',
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
            fontSize: 'clamp(13px, 1.5vw, 17px)',
            padding: 'clamp(14px, 1.8vw, 20px)',
            justifyContent: 'center',
            textAlign: 'center',
          }}
        >
          SAVE IMAGE ↓
        </button>
      </div>

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
    </>
  );
}
