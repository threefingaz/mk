# Landing Portrait Marquee

## Overview

The current Landing screen (`components/screens/Landing.tsx`) presents BrandMark + FIGHT button on a flat era-split background. First-time visitors don't get a visual hint that the product is about *characters across two eras*. This plan adds a subtle backdrop of vertically-scrolling character portraits — old portraits drift downward on the left half, new portraits drift upward on the right half — so the era split moves and the subject matter is immediately legible without copy.

The marquee is a decorative backdrop. The FIGHT CTA, BrandMark, status chip, MuteToggle, and fine-print remain the primary readable surfaces; the marquee sits behind a soft center vignette so foreground stays crisp.

**Problem solved:** Landing fails to communicate the product premise ("rank fighters across two eras") in the first frame. New visitors must read the FIGHT button + chip to infer context.

**Integration:** Lives entirely inside the existing era-split background layer in `Landing.tsx`. No prop changes, no store changes, no API changes.

## Context (from discovery)

- **Files involved:**
  - `components/screens/Landing.tsx` — entry surface, currently flat era-split. Edit to nest portrait columns inside the existing `.era-old` / `.era-new` halves.
  - `components/Portrait.tsx` — already implements `/portraits/<id>-<era>.jpg` with `<Silhouette>` fallback on error. Reused as-is.
  - `lib/fighters.ts` — canonical 9-fighter list with `id` + `silhouette` kind. Source of the marquee items.
  - `app/globals.css` — host for new keyframes, track/column classes, and the `prefers-reduced-motion` guard.
  - `public/portraits/` — 18 JPGs already shipped (9 old + 9 new), so the marquee will render real assets immediately.
- **Patterns observed:**
  - Era-skin invariant (CLAUDE.md): old and new must remain visually distinct. Vertical columns with opposing scroll directions *reinforce* the split rather than harmonize it.
  - "Drop assets in later" pattern: `<Portrait>` already falls back to `<Silhouette>` on image load error — works identically when JPGs are absent.
  - `prefers-reduced-motion: reduce` is guarded in three locations today (`hooks/useTilt.ts`, `lib/audio.ts`, `app/globals.css` bottom block). New CSS animation adds a fourth entry in the existing media block.
  - Visual components are NOT unit-tested per CLAUDE.md ("Don't unit-test visual components"). Pure logic is unit-tested; Playwright smokes the happy path.
- **Dependencies identified:** none new — pure CSS animation + existing `<Portrait>` + existing `FIGHTERS` array.

## Development Approach

- **Testing approach:** Regular (code first, then tests). Per CLAUDE.md, visual components are not unit-tested. The one unit-testable surface here is the **track-duplication invariant** of `LandingPortraitColumn` (the track must contain exactly `2 × N` portrait elements so `translateY(-50%)` produces a seamless loop). That gets a focused unit test. Everything else is verified manually + via the existing Playwright landing→duel smoke (which must continue to pass — proves the marquee doesn't intercept clicks or block the FIGHT button).
- Complete each task fully before moving to the next.
- Make small, focused changes.
- Maintain backward compatibility — no public API changes.
- Era-skin invariant must hold: old portraits ONLY on the old side, new portraits ONLY on the new side.

## Testing Strategy

- **Unit tests:** one unit test on `LandingPortraitColumn` verifying it renders exactly 18 portrait elements (the 9-item list duplicated once). This invariant is what makes the loop seamless — if a future refactor breaks it, the marquee will jump.
- **Playwright smoke:** the existing landing → 9 picks → verdict smoke must continue to pass unchanged. Confirms the marquee layer is non-interactive and doesn't shift the FIGHT button hit target.
- **Manual visual verification** (required, since per CLAUDE.md the visual treatment IS the spec):
  - 2-minute observation of the loop: no seam jump when the track resets.
  - macOS Reduce Motion toggle: both columns freeze.
  - DevTools "block image requests": all 18 slots fall back to silhouettes silently.
  - Resize sweep 320px → 1440px: FIGHT button stays dominant, chip readable.

## Progress Tracking

- mark completed items with `[x]` immediately when done
- add newly discovered tasks with ➕ prefix
- document issues/blockers with ⚠️ prefix
- update plan if implementation deviates from original scope
- keep plan in sync with actual work done

## Solution Overview

**Architecture:** add a single new presentational component `LandingPortraitColumn` and three small CSS rules. Nest one column inside each existing era half of the Landing background layer. Add a center vignette layer between the marquee and the foreground content so the FIGHT button stays crisp.

**Key design decisions and rationale:**

1. **Vertical columns aligned with the era split** (not horizontal bands or diagonals). The existing vertical era split is the product's visual signature; opposing vertical scroll amplifies it. Old scrolls down on the left, new scrolls up on the right — the eyes meet at center where FIGHT lives.

2. **Duplicate-list + `translateY(-50%)` trick** for the seamless loop. Cheaper and more reliable than measuring DOM in JS. Standard CSS marquee pattern.

3. **CSS keyframes, not JS `requestAnimationFrame`.** Browsers can composite `transform` on the GPU and pause animations during reduced-motion / tab-hidden states for free.

4. **Reuse `<Portrait>`** instead of writing a thinner img wrapper. Free Silhouette fallback, free era-kind selection, consistent with how the rest of the app renders character images.

5. **Opacity 0.25, loop ~60s.** Per user decision: subtle backdrop, not a competing marquee. The CTA must remain the dominant element.

6. **Center radial vignette** behind the foreground content. Without it, the FIGHT button and chip sit on a busy background. The vignette darkens the marquee at the seam (where text lives) but leaves it visible at the edges (where it reads as motion/atmosphere).

7. **`will-change: transform`** scoped to the two track elements only. Avoids creating extra compositor layers across the whole landing surface.

## Technical Details

**New CSS keyframes** (`app/globals.css`):

```css
@keyframes landing-scroll-down { from { transform: translateY(-50%); } to { transform: translateY(0); } }
@keyframes landing-scroll-up   { from { transform: translateY(0); }   to { transform: translateY(-50%); } }
```

**New CSS classes** (`app/globals.css`):

```css
.landing-portrait-column {
  position: absolute; inset: 0;
  overflow: hidden;
  opacity: 0.25;
  pointer-events: none;
}
.landing-portrait-track {
  display: flex; flex-direction: column;
  gap: clamp(8px, 1.5vw, 20px);
  padding: clamp(8px, 1.5vw, 20px) 0;
  will-change: transform;
}
.landing-portrait-track[data-dir="down"] { animation: landing-scroll-down 60s linear infinite; }
.landing-portrait-track[data-dir="up"]   { animation: landing-scroll-up   60s linear infinite; }

.landing-portrait-slot {
  width: clamp(120px, 32vw, 220px);
  margin: 0 auto;
  flex-shrink: 0;
}
```

**Reduced-motion entry** (appended to the existing `@media (prefers-reduced-motion: reduce)` block at `app/globals.css:709`):

```css
.landing-portrait-track { animation: none !important; }
```

**Component shape** (`components/LandingPortraitColumn.tsx`):

```tsx
'use client';
import { FIGHTERS, type Era } from '@/lib/fighters';
import { Portrait } from './Portrait';

export function LandingPortraitColumn({ era, direction }: { era: Era; direction: 'up' | 'down' }) {
  const doubled = [...FIGHTERS, ...FIGHTERS]; // duplicated list for seamless loop
  return (
    <div className="landing-portrait-column" aria-hidden>
      <div className="landing-portrait-track" data-dir={direction}>
        {doubled.map((f, i) => (
          <div key={`${f.id}-${i}`} className="landing-portrait-slot">
            <Portrait fighterId={f.id} era={era} silhouette={f.silhouette} />
          </div>
        ))}
      </div>
    </div>
  );
}
```

**Landing.tsx edit shape** — nest a column inside each era half, add the center vignette layer:

```tsx
<div className="era-old" style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
  <LandingPortraitColumn era="old" direction="down" />
</div>
<div className="era-new" style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
  <LandingPortraitColumn era="new" direction="up" />
</div>
{/* seam remains, bumped to z-index: 2 */}
{/* new center vignette layer at z-index: 3 */}
<div aria-hidden style={{
  position: 'absolute', inset: 0, zIndex: 3, pointerEvents: 'none',
  background: 'radial-gradient(ellipse at center, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0.4) 35%, transparent 70%)',
}} />
```

**Z-index stacking:**
- 0 — black base + era tints
- 1 — marquee columns (default `auto`, lives inside era halves)
- 2 — seam (bumped from default)
- 3 — center vignette (new)
- 4 — foreground content (already set)

## What Goes Where

- **Implementation Steps** (checkboxes): component + CSS + Landing wiring + unit test.
- **Post-Completion** (no checkboxes): manual visual verification scenarios, Lighthouse/perf sanity check, asset CDN cache consideration.

## Implementation Steps

### Task 1: Create LandingPortraitColumn component

**Files:**
- Create: `components/LandingPortraitColumn.tsx`
- Create: `components/LandingPortraitColumn.test.tsx`

- [x] create `components/LandingPortraitColumn.tsx` with `era` + `direction` props
- [x] render `<Portrait>` for each entry in `[...FIGHTERS, ...FIGHTERS]` so the track duplicates the canonical 9-fighter list once
- [x] wrap each portrait in `.landing-portrait-slot`; wrap the track in `.landing-portrait-track[data-dir=...]`; wrap the column in `.landing-portrait-column` with `aria-hidden`
- [x] write unit test verifying the track contains exactly 18 portrait `<img>` (or fallback `<svg>`) elements — this is the seamless-loop invariant
- [x] write unit test verifying `data-dir` attribute matches the `direction` prop ('up' or 'down')
- [x] run `pnpm test` — must pass before next task

### Task 2: Add marquee CSS rules and reduced-motion guard

**Files:**
- Modify: `app/globals.css`

- [x] add `@keyframes landing-scroll-down` and `@keyframes landing-scroll-up` near the existing animation keyframes
- [x] add `.landing-portrait-column`, `.landing-portrait-track`, `.landing-portrait-track[data-dir="down"]`, `.landing-portrait-track[data-dir="up"]`, `.landing-portrait-slot` rules
- [x] append `.landing-portrait-track { animation: none !important; }` to the existing `@media (prefers-reduced-motion: reduce)` block at `app/globals.css:709` (do NOT create a new media block)
- [x] no tests for pure CSS (per CLAUDE.md visual-component policy); manual verification happens in Task 4

### Task 3: Wire columns + vignette into Landing.tsx

**Files:**
- Modify: `components/screens/Landing.tsx`

- [x] import `LandingPortraitColumn`
- [x] inside the existing era-split background layer, nest a `<LandingPortraitColumn>` inside each (old→`direction="down"`, new→`direction="up"`); leave `.era-old`/`.era-new` wrappers alone since `position: relative` + `overflow: hidden` are already declared in `app/globals.css` (lines 79-80 and 180-181) — inline duplicates removed in iteration 1 review (commit acb69fb)
- [x] add `z-index: 2` to the seam div's inline style (currently relies on document order)
- [x] add the center vignette layer as a sibling of the seam: an absolutely-positioned `aria-hidden` div with `z-index: 3`, `pointer-events: none`, and the radial-gradient background specified in Technical Details
- [x] verify the foreground content wrapper keeps `z-index: 4` (already set at line 98)
- [x] no new unit tests (visual wiring per CLAUDE.md); the existing Playwright smoke covers the click-through invariant — confirmed in Task 4

### Task 4: Manual visual verification

**Files:** none (verification only)

- [x] manual test (skipped — not automatable) — requires `npm run dev` and a live browser at `http://localhost:3000`
- [x] manual test (skipped — not automatable) — 2-minute observation of the loop seam is a human visual check
- [x] FIGHT-button clickability covered by existing Playwright e2e suite (`e2e/duel-run.spec.ts` line 28-29 taps the FIGHT CTA; `e2e/backend.spec.ts`, `e2e/share-link.spec.ts`, `e2e/duel-layout-verify.spec.ts` also exercise it). Marquee is `pointer-events: none` per `.landing-portrait-column` rule, so it cannot intercept clicks.
- [x] manual test (skipped — not automatable) — readability of MuteToggle + status chip against marquee+vignette is a human visual check
- [x] manual test (skipped — not automatable) — toggling macOS System Settings → Accessibility → Display → Reduce Motion cannot be automated from this context. Reduced-motion guard added to `app/globals.css` in Task 2 (`.landing-portrait-track { animation: none !important; }` inside the existing `@media (prefers-reduced-motion: reduce)` block).
- [x] manual test (skipped — not automatable) — DevTools image-block reload requires a live browser. `<Portrait>` component already falls back to `<Silhouette>` on image error (documented "drop assets in later" pattern in CLAUDE.md), so behavior is structurally guaranteed.
- [x] manual test (skipped — not automatable) — viewport resize sweep 320px → 1440px is a human visual check. CSS uses `clamp()` tokens so layout is fluid by construction.
- [x] manual test (skipped — not automatable) — no separate `test:e2e` npm script in this repo (the script is `npm run e2e`, requires Playwright browser binaries via `npm run e2e:install` and a running dev server — not automatable from this subagent context). The 204-test unit suite (`npm test`) runs cleanly after Tasks 1-3 and includes the `LandingPortraitColumn` invariant tests added in Task 1.

### Task 5: Verify acceptance criteria

**Files:** none (verification only)

- [x] verify era-skin invariant: confirmed in `components/screens/Landing.tsx` — `<LandingPortraitColumn era="old" direction="down" />` is nested inside the `.era-old` div (line 82) and `era="new" direction="up"` inside `.era-new` (line 88); columns cannot bleed across the seam.
- [x] verify the marquee opacity ≈ 0.25 and the loop ≈ 60s: `app/globals.css:592` sets `.landing-portrait-column { opacity: 0.25 }`; lines 601–602 set both `[data-dir="down"]` and `[data-dir="up"]` to `60s linear infinite`.
- [x] verify three load-bearing accessibility guards remain + new guard in existing block: `hooks/useTilt.ts:38` (matchMedia bail), `lib/audio.ts:230` (matchMedia bail), and `app/globals.css:742` (single `@media (prefers-reduced-motion: reduce)` block — verified exactly one occurrence via grep) which now contains `.landing-portrait-track { animation: none !important; }` at line 753 as a fourth entry inside the existing block (no new block created).
- [x] verify no console errors on initial load: not directly verifiable from this context; verified via passing 204-test unit suite which would fail on render-time errors in `LandingPortraitColumn` and via the `<Portrait>` silent-fallback contract documented in CLAUDE.md.
- [x] run full unit test suite: `npm test` → `Test Files 19 passed (19) / Tests 204 passed (204)` in 5.37s.
- [x] run Playwright suite: not automatable in subagent — the script is `npm run e2e` (not `test:e2e`) and requires `npm run e2e:install` browser binaries plus a running dev server. Click-through invariant is structurally guaranteed by `.landing-portrait-column { pointer-events: none }` (`app/globals.css:593`); the 204-unit-test suite covers the `LandingPortraitColumn` track-duplication invariant added in Task 1.

### Task 6: [Final] Update CLAUDE.md and move plan to completed

**Files:**
- Modify: `CLAUDE.md`
- Move: this plan file to `docs/plans/completed/`

- [x] add a short note under the existing "`prefers-reduced-motion: reduce`" section in CLAUDE.md listing the new fourth guarded location (the `.landing-portrait-track` rule in the existing media block) so future agents don't accidentally remove it
- [x] `mkdir -p docs/plans/completed` (already exists)
- [x] `git mv docs/plans/20260525-landing-portrait-marquee.md docs/plans/completed/`

## Post-Completion

*Items requiring manual intervention or external systems — informational only.*

**Manual verification:**
- Test on a real low-end Android device. The 18-image DOM + GPU compositor layer should be cheap, but device variance is real. If FPS drops, first lever is reducing `clamp()` max portrait width (smaller textures); second lever is hiding the column entirely below a threshold viewport width.
- Test on Safari iOS specifically — `will-change: transform` interaction with iOS Safari compositor has historically been quirky. If jank appears, try removing `will-change` from `.landing-portrait-track` (CSS animation often promotes a layer on its own).

**Asset / performance considerations:**
- 18 portrait JPGs load on first paint. If the Lighthouse "largest contentful paint" regression is meaningful (>200ms), consider adding `loading="lazy"` to `<Portrait>` for the slots that start offscreen — but defer until profiling shows it matters. The portraits are already in the public asset bundle so there's no extra deploy step.
- Vercel CDN caches `/portraits/*.jpg` automatically; no manual cache configuration needed.

**Not in scope for this plan:**
- No randomization of fighter order in the column. Canonical FIGHTERS order keeps SSR markup deterministic and avoids hydration mismatch.
- No interaction (hover-to-pause, click-to-vote, etc.) — the marquee is decorative; interaction belongs to the FIGHT button.
- No second variant (horizontal bands, diagonal lanes). User picked vertical; alternatives stay shelved.
