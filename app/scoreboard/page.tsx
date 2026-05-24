'use client';

// /scoreboard route (Task 15, updated in Task 25) — standalone page rendering
// the Scoreboard component. Reads crowd state from /api/results via the
// resilience client; failures degrade silently to pre-unlock UI (no error
// surfacing, no retry, no loading spinner).
//
// The shell paints a minimal empty state while the first fetch is in flight.
// Once results arrive, the Scoreboard renders with either pre-unlock (locked
// countdown) or post-unlock (9-row table) variant per the payload's
// `unlocked` flag.

import { useEffect, useState } from 'react';
import { Scoreboard } from '@/components/screens/Scoreboard';
import { DisclaimerRibbon } from '@/components/DisclaimerRibbon';
import { fetchResults, type ResultsPayload } from '@/lib/api-client';

export default function ScoreboardPage() {
  const [results, setResults] = useState<ResultsPayload | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetchResults().then((payload) => {
      if (cancelled) return;
      setResults(payload);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <>
      {results === null ? (
        // Loading skeleton — keeps the page from flashing locked-state content
        // before the first fetch resolves. fetchResults() never throws and
        // always resolves quickly (network or fallback), so this is brief.
        <div
          data-testid="scoreboard-loading"
          style={{
            minHeight: '100vh',
            background: '#000',
          }}
        />
      ) : (
        <Scoreboard
          unlocked={results.unlocked}
          crowdStats={results.stats ?? {}}
          plays={results.plays}
          threshold={results.threshold}
        />
      )}
      <DisclaimerRibbon />
    </>
  );
}
