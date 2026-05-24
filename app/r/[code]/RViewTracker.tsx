'use client';

// RViewTracker — fires the `r_view` analytics event on mount (Task 28).
//
// The /r/[code] page is a server component for the initial HTML render, so the
// analytics call lives in this tiny client island. Empty deps + a useEffect
// fire-once contract (Vercel's track() is queued in the browser, server is a
// no-op, so this is safe in any environment).
//
// React strict-mode will double-mount in dev — `track()` is idempotent on the
// queue side and we don't gate further behavior on it, so we accept the
// duplicate dev fire rather than add a useRef guard. Production fires once.

import { useEffect } from 'react';
import { trackEvent } from '@/lib/analytics';

export function RViewTracker(): null {
  useEffect(() => {
    trackEvent({ name: 'r_view' });
  }, []);
  return null;
}
