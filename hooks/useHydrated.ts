'use client';

// useHydrated — one-shot client-only hydration flag.
//
// Returns `false` on the server and on the first client render, then `true`
// after the mount-effect fires. Used to gate UI that depends on persisted
// state or browser-only feature detection so SSR + the first client render
// agree (no hydration mismatch), then the real value flips in.
//
// The set-state-in-effect pattern is the whole point — we explicitly want
// both renders to see `false` and then flip true. The lint suppression is
// scoped to this hook so callers don't have to re-suppress it.

import { useEffect, useState } from 'react';

export function useHydrated(): boolean {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHydrated(true);
  }, []);
  return hydrated;
}
