// LandingPortraitColumn — decorative marquee column for the Landing screen.
// Renders the canonical 9-fighter portrait list duplicated once (18 slots) so
// the CSS `translateY(-50%)` keyframe produces a seamless loop. Direction is
// driven by a `data-dir` attribute the CSS rule keys on.
//
// Era-skin invariant (CLAUDE.md): old portraits ONLY on the old side, new
// portraits ONLY on the new side. Callers nest one column per era half.
//
// The column is decorative (aria-hidden) and non-interactive (pointer-events
// disabled via CSS). Reused <Portrait> gives free <Silhouette> fallback when
// the JPGs aren't shipped, matching the "drop assets in later" pattern.

import { FIGHTERS, type Era } from '@/lib/fighters';
import { Portrait } from './Portrait';

export function LandingPortraitColumn({
  era,
  direction,
}: {
  era: Era;
  direction: 'up' | 'down';
}) {
  const doubled = [...FIGHTERS, ...FIGHTERS];
  return (
    <div className="landing-portrait-column" aria-hidden>
      <div className="landing-portrait-track" data-dir={direction}>
        {doubled.map((f, i) => (
          <div key={`${f.id}-${i}`} className="landing-portrait-slot">
            {/* loading="lazy" + decoding="async": the marquee is decorative
                backdrop — these 18 JPGs must not compete with the FIGHT
                button for first-paint bandwidth or main-thread decode time. */}
            <Portrait
              fighterId={f.id}
              era={era}
              silhouette={f.silhouette}
              loading="lazy"
              decoding="async"
            />
          </div>
        ))}
      </div>
    </div>
  );
}
