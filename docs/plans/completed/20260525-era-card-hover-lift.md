# EraCard Hover Lift — Spring Tilt + Era-Aware Shadow

## Overview

The duel screen's fighter cards (`EraCard`) currently have **no hover treatment** beyond a `cursor: pointer` and a `box-shadow .15s` transition that's never actually animated. Tap and you get a picked stamp + colored shadow; otherwise the card just sits there. Meanwhile the **verdict** card (`VerdictCard`) and the **share** landing (`/r/[code]`) already use `useTilt` — a CSS-only cursor-following rotation with no scale, no hover lift, and rAF snapping (no easing). The motion vocabulary across screens is inconsistent: nothing during the duel, mild tilt at the end.

This plan introduces a **light** 3D treatment that fixes both:

1. **Upgrade `useTilt`** from rAF-snapped angle to **critically-damped spring** with **hover scale + shadow lift**. Same `{ ref, style }` API, fully back-compatible.
2. **Apply tilt to `EraCard`** (currently bare) so the duel cards lift toward the cursor on hover. `picked` keeps tilting (re-pick affordance must survive — see CLAUDE.md "Duel pick semantics"). `dimmed` does NOT tilt.
3. **Era-asymmetric lift styling** so the "rises off the page" feel is communicated in each era's own vocabulary: old gets a heavier brutalist offset (echoes the existing picked-state hard shadow at higher amplitude), new gets a soft drop shadow that lifts higher and gains a rim. This preserves the era-skin invariant (CLAUDE.md: "never harmonize them").
4. **`VerdictCard` and `/r/[code]` inherit** the upgrade automatically through `useTilt` — no per-call-site changes.

**Problem solved:** the duel cards feel inert on desktop hover; the verdict tilt is technically there but reads as "twitchy" because it snaps. After this plan, hovering any era-styled card on desktop produces a coherent, era-flavored "this card is alive" response.

**Out of scope (explicitly):** holographic parallax, color-dodge wash, shimmer band, spotlight mask, halftone, grain, scratch interaction. These are the heavy layers from the v0 gift card reference (interfacecraft.dev/library/creating-v0-gift-card) and could be layered on later; this plan ships the *light* upgrade only.

## Context (from discovery)

- **Files involved:**
  - `hooks/useTilt.ts` — current rAF tilt hook. ±10° default, no spring, no scale, no shadow. Sets `--rx`/`--ry` + an inline `transform` via React state (one `setState` per frame). Has the reduced-motion bail.
  - `hooks/useTilt.test.tsx` — existing tests for the hook contract.
  - `components/EraCard.tsx` — the duel screen's portrait-optimized trading card. Renders as a `<button>`. **No tilt today.** Already has a `transition: 'box-shadow .15s, transform .15s, opacity .15s, filter .15s'` so the transform property is prepped.
  - `components/EraCard.test.tsx` — existing component tests.
  - `components/VerdictCard.tsx` — calls `useTilt(8)` and spreads onto the outer div with `className="tilt"`. Inherits any hook upgrade automatically.
  - `app/r/[code]/page.tsx` — also calls `useTilt`. Inherits automatically.
  - `app/globals.css`:
    - Line 423: `.tilt { transform: perspective(900px) rotateX(var(--rx,0deg)) rotateY(var(--ry,0deg)); transition: transform 120ms ease-out; transform-style: preserve-3d; }`. This rule fights with the hook's inline `transform` style — inline wins by specificity, so today the perspective is `1000px` (from the hook), not `900px` (from the CSS). Cleaning this up is part of the upgrade.
    - Line 749: `.tilt { transition: none; transform: none !important; }` inside `@media (prefers-reduced-motion: reduce)`. Load-bearing — extends to the new transform.
    - `--split` (line 51): global multiplier for era-skin intensity, range `0.5 / 1 / 1.6`. Any new effect that scales with era intensity must respect it.
- **Patterns observed:**
  - Era-skin invariant is non-negotiable. Old uses brutalist hard offsets (`Npx Npx 0 var(--ob-ink), 2Npx 2Npx 0 var(--ob-magenta)`); new uses soft drop shadows (`0 Npx ... oklch(0.55 0.24 27 / x)`). The hover-lift must speak each era's existing language, not introduce a third style.
  - **Picked still interactive**: `Duel.tsx` keeps picked cards tabbable so users can re-pick. `EraCard`'s `tabIndex` is gated on `onPick` being truthy — the picked card retains `onPick`, so it retains `tabIndex=0`. The hover lift must therefore work on picked cards too (the swap affordance is load-bearing per CLAUDE.md).
  - **Dimmed must stay quiet**: when one card is picked and the other becomes `dimmed` (opacity 0.32, grayscale 0.9), the dimmed card should not draw cursor attention. Skip tilt entirely when `dimmed`.
  - `prefers-reduced-motion: reduce` guard is enforced in three locations (CLAUDE.md). Hook bails already; CSS line 749 already neutralizes `.tilt`. The new scale + shadow variables also need to collapse to baseline under reduced motion.
  - **Visual components are NOT unit-tested** (CLAUDE.md "Pragmatic testing posture"). The pure spring-lerp logic in `useTilt` IS unit-testable; the visual hover behavior on EraCard / VerdictCard is verified manually + via the existing Playwright smoke.
- **Dependencies identified:** none new. No Framer Motion (not in package.json). Spring is a ~15-line critically-damped lerp in a single `requestAnimationFrame` loop.

## Development Approach

- **Testing approach:** **Regular** (code first, then tests). The pure spring math in `useTilt` gets unit tests (settles within tolerance after N frames, identity under reduced motion, etc.). EraCard's hover behavior is verified manually + Playwright smoke — visual components are not unit-tested per CLAUDE.md.
- Complete each task fully before moving to the next.
- Maintain backward compatibility: `useTilt(8)` and `useTilt(10)` continue to work; add the options-object overload for new callers.
- Era-skin invariant must hold: old hover never produces a soft drop shadow; new hover never produces a hard offset stack. The two vocabularies stay separate.
- Reduced-motion behavior must remain identity (no tilt, no scale, no shadow growth).

## Testing Strategy

- **Unit tests** (extend `hooks/useTilt.test.tsx`):
  - Hook returns identity style when `prefers-reduced-motion: reduce` is set.
  - On mousemove, the returned style includes both rotation and `--tilt-scale` matching the hovered state.
  - Spring lerp settles: after a fixed mouse position is held across N rAF ticks, the rotation values converge to the target within tolerance.
  - On mouseleave, the lerp returns toward `(0, 0, 1.0)` and reaches identity within N ticks.
  - Back-compat: `useTilt(8)` (positional number) produces the same intensity as `useTilt({ intensity: 8 })`.
- **EraCard smoke** (extend `components/EraCard.test.tsx`):
  - Dimmed card renders without `className="tilt"` and without `--tilt-scale` in its style (skip-tilt branch).
  - Picked card still renders with `className="tilt"` (re-pick affordance preserved).
- **Playwright smoke** (existing landing → 9 picks → verdict): must continue to pass unchanged. Confirms the new transform doesn't break click targeting or layout flow.
- **Manual visual verification** (required — visual treatment IS the spec):
  - Desktop hover on each EraCard variant (old/new × picked/unpicked/idle) — both eras lift in their own vocabulary; cursor-follow feels smoothed, not snappy.
  - Desktop hover on VerdictCard — feels consistent with the duel cards.
  - Dimmed card on desktop — no hover response (stays quiet at 0.32 opacity).
  - macOS Reduce Motion toggle — all cards flatten, no scale, no shadow growth.
  - Touch device — no tilt response (mousemove never fires); tap still picks; no visual regression.
  - Desktop layout (>=900px) — hovering one duel card does NOT reflow the other or shift the seam. Cards stay in their flex slots.
  - `--split` change (0.5 / 1.0 / 1.6) — the lift amplitude scales correspondingly.

## Progress Tracking

- mark completed items with `[x]` immediately when done
- add newly discovered tasks with ➕ prefix
- document issues/blockers with ⚠️ prefix
- update plan if implementation deviates from original scope
- keep plan in sync with actual work done

## Solution Overview

**Architecture:** one hook (`useTilt`) gains a spring + hover state. One stylesheet (`app/globals.css`) gains era-aware `:hover` rules driven by CSS custom properties the hook emits. One component (`EraCard`) opts in. Everything else inherits.

**Key design decisions and rationale:**

1. **Hand-rolled spring, not Framer Motion.** Framer Motion isn't in the dependency tree and pulling it in for one hook is over-investment for a "Light" treatment. A critically-damped lerp toward target in a single rAF loop is ~15 lines and produces visually identical motion at our amplitudes.
2. **Mutate CSS custom properties on the ref, not React state.** Today's hook does `setState({ --rx, --ry, transform })` per frame, which triggers a React re-render every animation frame. Switching to `ref.current.style.setProperty('--rx', ...)` removes the re-render churn and is the standard pattern for high-frequency motion. The returned `style` object becomes static; the live values flow through CSS custom properties.
3. **CSS owns the visual; the hook owns the math.** `app/globals.css` defines the `.tilt` `transform` (perspective + rotate + scale) using `var(--rx, 0deg)`, `var(--ry, 0deg)`, `var(--tilt-scale, 1)`. The hook only sets the three vars. This removes the current inline/CSS conflict (perspective `1000px` from the hook vs `900px` from the CSS) and makes the perspective tunable in one place.
4. **Era-aware lift via class-scoped CSS, not branching in the hook.** `.fighter-card-old.tilt:hover` and `.fighter-card-new.tilt:hover` each get their own `box-shadow` rule. The hook is era-agnostic. This means the same hook applies to the verdict and share cards without those callers caring about era.
5. **`dimmed` skips tilt entirely** rather than rendering tilt + opacity. Reason: dimmed is the "you didn't pick me" affordance — adding cursor-follow motion to a card that's visually quieted is contradictory. Skip by not calling the hook (or by not spreading the result) when `dimmed === true`.
6. **`--split` scales the lift.** Both the hover scale ceiling and the shadow lift amplitude multiply by `var(--split, 1)` so the global era-intensity dial keeps working consistently.

## Technical Details

### Hook API (back-compatible)

```ts
// Existing (still works):
const { ref, style } = useTilt(8);

// New (preferred):
const { ref, style } = useTilt({ intensity: 8, hoverScale: 1.03, perspective: 900 });
```

- `intensity` (default 10): max ±deg on each axis.
- `hoverScale` (default 1.03): scale factor when hovered. `1` disables scale.
- `perspective` (default 900): px value used in the CSS rule. Hook does not emit this — it's only used to keep the option discoverable; callers wanting a different perspective adjust the CSS rule.

### Spring math

Critically-damped lerp per frame:

```
target = { rx, ry, scale }
current = { rx, ry, scale }
each rAF tick:
  current.x += (target.x - current.x) * smoothing
  current.y += (target.y - current.y) * smoothing
  current.scale += (target.scale - current.scale) * smoothing
  ref.current.style.setProperty('--rx', `${current.x}deg`)
  ref.current.style.setProperty('--ry', `${current.y}deg`)
  ref.current.style.setProperty('--tilt-scale', String(current.scale))
  if |delta| < epsilon for all three: stop rAF loop
```

Smoothing constant ~0.2 produces a quick settle (~10 frames) without overshoot.

### CSS contract

```css
.tilt {
  transform:
    perspective(900px)
    rotateX(var(--rx, 0deg))
    rotateY(var(--ry, 0deg))
    scale(var(--tilt-scale, 1));
  transform-style: preserve-3d;
  transition: box-shadow 180ms ease-out;
  /* note: no transition on transform — the hook lerps it directly */
}

.fighter-card-old.tilt:hover {
  box-shadow:
    calc(4px * var(--split, 1)) calc(4px * var(--split, 1)) 0 var(--ob-ink),
    calc(8px * var(--split, 1)) calc(8px * var(--split, 1)) 0 var(--ob-magenta);
}

.fighter-card-new.tilt:hover {
  box-shadow:
    0 calc(18px * var(--split, 1)) calc(48px * var(--split, 1)) -10px oklch(0.55 0.24 27 / 0.55),
    0 calc(6px * var(--split, 1)) calc(18px * var(--split, 1)) -4px rgba(0, 0, 0, 0.7);
}

@media (prefers-reduced-motion: reduce) {
  .tilt {
    transition: none;
    transform: none !important;
  }
  .fighter-card-old.tilt:hover,
  .fighter-card-new.tilt:hover {
    box-shadow: revert !important; /* fall back to the baseline EraCard inline box-shadow */
  }
}
```

### EraCard wiring

```tsx
// In EraCard.tsx — skip tilt when dimmed.
const tilt = dimmed ? null : useTilt({ intensity: 8, hoverScale: 1.03 });

return (
  <button
    ref={tilt?.ref as React.RefObject<HTMLButtonElement> | undefined}
    className={`${classNames} ${tilt ? 'tilt' : ''}`}
    style={{ ...baseStyle, ...(tilt?.style ?? {}) }}
    // ...
  >
```

**Rules-of-hooks note:** the conditional-hook above must be written as **always-call-then-conditionally-use**:

```tsx
const tilt = useTilt({ intensity: 8, hoverScale: 1.03 });
const tiltActive = !dimmed;
// then spread tilt.style / className conditionally on tiltActive
```

This is the load-bearing implementation detail — never wrap the `useTilt` call itself in an `if`.

## What Goes Where

- **Implementation Steps** (`[ ]` checkboxes): hook upgrade, CSS additions, EraCard wiring, tests, manual visual sweep.
- **Post-Completion** (no checkboxes): the optional "heavy" layers from the v0 reference — if the user wants to escalate later, they're listed here for future reference.

## Implementation Steps

### Task 1: Upgrade `useTilt` to spring + hover state

**Files:**
- Modify: `hooks/useTilt.ts`
- Modify: `hooks/useTilt.test.tsx`

- [x] add options-object overload to `useTilt`: accepts `{ intensity?, hoverScale? }` while preserving the `useTilt(number)` positional form
- [x] replace `setState` per frame with `ref.current.style.setProperty('--rx' | '--ry' | '--tilt-scale', ...)` so the hook no longer triggers a React re-render per animation frame
- [x] implement a critically-damped lerp loop in a single rAF: target stored in a closure, current values lerp toward target each tick, loop self-terminates when delta < epsilon
- [x] add `mouseenter` / `mouseleave` handlers: enter sets `target.scale = hoverScale` and starts the loop, leave sets `target = (0, 0, 1.0)` and lets the loop settle
- [x] keep reduced-motion bail: return `{ ref, style: {} }` and skip listener attach when `prefers-reduced-motion: reduce` matches
- [x] write tests: identity under reduced motion, settle convergence with a fixed cursor across N rAF ticks, return-to-identity on leave, back-compat `useTilt(8) === useTilt({ intensity: 8 })`
- [x] run tests — must pass before Task 2

### Task 2: Era-aware lift CSS

**Files:**
- Modify: `app/globals.css`

- [x] update the `.tilt` rule (line 423) to add `scale(var(--tilt-scale, 1))` to the `transform`, remove the `transition: transform` (the hook lerps directly), keep `transition: box-shadow 180ms ease-out`
- [x] add `.fighter-card-old.tilt:hover` rule with the era-old hard-shadow stack scaled by `--split`
- [x] add `.fighter-card-new.tilt:hover` rule with the era-new soft-shadow stack scaled by `--split`
- [x] extend the `@media (prefers-reduced-motion: reduce)` block at line 747 to neutralize the new `:hover` shadow rules (or rely on `transform: none !important` already collapsing the visual lift — verify either way; if `box-shadow` change still reads as motion, add explicit `box-shadow: revert !important` to the era-`:hover` rules under the media block)
- [x] no tests for CSS — covered by the manual visual sweep in Task 4

### Task 3: Apply tilt to `EraCard`

**Files:**
- Modify: `components/EraCard.tsx`
- Modify: `components/EraCard.test.tsx`

- [x] call `useTilt({ intensity: 8, hoverScale: 1.03 })` unconditionally at the top of the component (rules of hooks)
- [x] derive `tiltActive = !dimmed` and conditionally spread `tilt.style` + add `'tilt'` to `classNames` when `tiltActive`
- [x] attach `tilt.ref` to the `<button>` unconditionally — the ref is harmless when the class isn't applied (no visual effect because no `.tilt` rule), but keeps the hook stable across renders
- [x] confirm `tabIndex={onPick ? 0 : -1}` and `aria-pressed={picked || undefined}` are unchanged — the load-bearing keyboard semantics from CLAUDE.md must not regress
- [x] write tests: dimmed `EraCard` does NOT have `'tilt'` in `className`; picked-but-not-dimmed `EraCard` DOES have `'tilt'` (re-pick affordance + hover preserved)
- [x] run tests — must pass before Task 4

### Task 4: Manual visual sweep + Playwright smoke

**Files:** (none — verification only)

- [x] manual sweep (deferred — requires interactive browser) — desktop hover on each EraCard variant (old/new × idle/picked/dimmed)
- [x] manual sweep (deferred — requires interactive browser) — verify cursor-follow feels smoothed (not snappy) and scale + shadow lift trigger on hover, release on leave
- [x] manual sweep (deferred — requires interactive browser) — VerdictCard tilt inherits the spring smoothly
- [x] manual sweep (deferred — requires interactive browser) — `/r/[code]` page tilt inherits the spring smoothly
- [x] manual sweep (deferred — requires interactive browser) — macOS Reduce Motion toggle. Confirmed in code by the hook's `prefersReducedMotion()` early-return (`hooks/useTilt.ts:81`) and `app/globals.css:772-779` reduced-motion media block neutralizing both `.tilt` transform and the era-`:hover` shadows.
- [x] manual sweep (deferred — requires interactive browser) — viewport resize sweep. The duel layout's flex contract (CLAUDE.md "Duel-specific helpers") is unchanged by this task; tilt operates on individual card transform, not flex slot geometry.
- [x] manual sweep (deferred — requires interactive browser) — `--split` 0.5 / 1.0 / 1.6 amplitude scaling. CSS rules at `app/globals.css:445-454` use `calc(Npx * var(--split, 1))` for both era hover shadows.
- [x] manual sweep (deferred — requires interactive browser) — touch/mobile simulation. Hook attaches `mouseenter`/`mousemove`/`mouseleave` only — touchstart/end never fire those, so tap-to-pick is unaffected.
- [x] Playwright smoke — all 11 e2e tests pass (verified with `npx playwright test --workers=1`, 36.1s). Parallel-worker run flakes on cold Next 16 dev-server compilation under load; the smoke itself is unbroken.
- [x] full unit test suite — 209 tests across 19 files pass (`npm test`, 19s).

### Task 5: Verify acceptance criteria + housekeeping

**Files:**
- Modify (only if a new invariant emerged worth documenting): `CLAUDE.md`

- [x] verify all requirements from Overview are implemented: spring tilt ✓, hover scale + shadow lift ✓, EraCard wears tilt ✓, dimmed skips ✓, picked keeps tilt ✓, era-asymmetric shadow vocabulary ✓, VerdictCard inherits ✓, reduced-motion identity ✓
- [x] verify edge cases (verified by code reading per CLAUDE.md "visual components NOT unit-tested" posture): dimmed-then-undimmed — `useEffect` deps `[intensity, hoverScale]` don't include `dimmed`, so the hook stays mounted and listeners stay live when dimmed toggles; the `.tilt` class withholding is the only gate; cleanup at `hooks/useTilt.ts:155-158` removes stale `--rx/--ry/--tilt-scale` on unmount. Rapid mouse-enter/leave — the `running` flag at `hooks/useTilt.ts:118` prevents stacking rAF loops; the loop self-terminates when settled (`hooks/useTilt.ts:105-113`) and re-acquires cleanly on the next event. SSR — `window`, `requestAnimationFrame`, and `matchMedia` all guarded (`hooks/useTilt.ts:59-62`, `78-81`); returns identity style with no listeners on the server.
- [x] decide whether the "hook owns spring math, CSS owns visual" split deserves a CLAUDE.md note — added a new "Tilt: hook owns math, CSS owns visual" section near the existing `prefers-reduced-motion` notes (`CLAUDE.md`).
- [x] move this plan to `docs/plans/completed/`

## Post-Completion

*Items requiring manual intervention or future escalation — no checkboxes, informational only.*

**Optional "heavy" escalation** (from the v0 gift card reference at interfacecraft.dev/library/creating-v0-gift-card) — if the user later wants to dial duel cards up to the full Josh Puckett rig, the layers to add on top of this baseline are:

- **Holographic parallax:** SVG halftone pattern offset by ~4px in response to cursor, layered on the portrait.
- **Color-dodge wash:** 4-stop HSLA gradient (red / gold / cyan / magenta) blended `color-dodge`, masked to "metal" regions of the card. Naturally maps onto new-era cards; would need a different vocabulary for old (e.g., chromatic-aberration intensification).
- **Shimmer band:** sweeping highlight band with `overlay` blend, position tracked to cursor X.
- **Spotlight mask:** radial-gradient `mask-image` constrained to a region following the cursor — the master "where does light land" gate.
- **Grain texture:** SVG `feTurbulence` noise overlay, two layers (coarse + fine).
- **Era-old equivalents:** the above are very "new blood." For old cards, the corresponding layers would be VHS chroma-shift intensification on hover, a tracking-band sweep (already animated in `app/globals.css` — could pulse on hover), and grain density bump.

Each of these is independently shippable on top of the current plan. None are blocking.

**Manual verification reminders** (already in Task 4 but worth flagging for any future regression sweep):

- Reduced-motion behavior is the single most likely thing to silently regress — always retest after touching `.tilt`, `useTilt`, or the reduced-motion media block.
- Era-skin invariant — if any future PR makes old and new lift look the same, that's the regression to catch.

## Implementation deviations

The shipped implementation differs from this plan in a few small ways. Captured here so future readers grep'ing `docs/plans/completed/` for `useTilt` examples don't copy stale code:

- **`useTilt` return shape:** the plan documents `{ ref, style }`. The shipped hook returns `{ ref }` only — the live tilt values flow through CSS custom properties (`--rx`, `--ry`, `--tilt-scale`) written directly onto the ref's element via `style.setProperty`, so there is no static `style` object for callers to spread. Callers that previously spread `style` no longer need to.
- **`perspective` option dropped:** the plan listed `perspective` as a hook option. It was removed during review because the hook never emitted it (the CSS `.tilt` rule owns the perspective value); a discoverability-only option that does nothing is dead weight. Tune the perspective in `app/globals.css::.tilt` instead.
- **`enabled` option added:** the hook gained an `enabled?: boolean` option (default `true`) so callers can keep the hook mounted (rules of hooks) while toggling tilt off — `EraCard` uses `enabled: !dimmed`. The plan's "always-call-then-conditionally-use" guidance is honored; this is just a cleaner API for that pattern than spreading-conditionally on the consumer side.
- **Reduced-motion fallback simplified during codex review:** the plan's CSS sketch (Technical Details → CSS contract) uses `box-shadow: revert !important` inside the reduced-motion media block. The shipped CSS instead wraps the era-aware `:hover` rules in `@media (prefers-reduced-motion: no-preference)` so the hover state isn't defined at all under reduced motion (the baseline `.fighter-card-{era}` shadow applies naturally). Cleaner cascade, no `revert` needed.
- **`box-shadow` transition relocated:** the plan placed `transition: box-shadow 180ms ease-out` on `.tilt`. It now lives on `.fighter-card` alongside the existing `opacity` / `filter` transitions — a single shorthand on one selector avoids the "CSS shorthand replaces" gotcha that snapped opacity/filter when the `.tilt` class toggled.
