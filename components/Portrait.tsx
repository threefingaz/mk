'use client';

// Portrait — renders a curated portrait at /portraits/<id>-<era>.jpg and
// falls back to <Silhouette> via onError when the file is absent.
//
// Production portraits arrive after engineering (see Post-Completion in the plan);
// until then every <Portrait> renders its silhouette. The era-treatment overlay
// in the parent <EraCard> composites identically over either the <img> or the
// <Silhouette> since both fill the same 4:5 box with position:absolute inset:0.

import { useState } from 'react';
import type { Era, FighterId, SilhouetteKind } from '@/lib/fighters';
import { portraitFor } from '@/lib/portraits';
import { Silhouette } from './Silhouette';

export function Portrait({
  fighterId,
  era,
  silhouette,
  className,
}: {
  fighterId: FighterId;
  era: Era;
  silhouette: SilhouetteKind;
  className?: string;
}) {
  const [errored, setErrored] = useState(false);

  const wrapperClass = className ? `portrait ${className}` : 'portrait';

  return (
    <div
      className={wrapperClass}
      style={{ position: 'relative', aspectRatio: '4 / 5', overflow: 'hidden' }}
    >
      {errored ? (
        <Silhouette kind={silhouette} era={era} />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element -- onError fallback to <Silhouette> requires a plain <img>; next/image doesn't expose a comparable error hook for masked SVG fallback.
        <img
          src={portraitFor(fighterId, era)}
          alt={`${fighterId} (${era})`}
          onError={() => setErrored(true)}
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            display: 'block',
          }}
        />
      )}
    </div>
  );
}
