# Desktop Layout

## Overview

The app currently ships a single mobile-first layout: every screen renders inside a 480px-max centered "phone frame" defined by `PAGE_FRAME_STYLE` in `app/page.tsx:49`. On a wide desktop monitor the UX feels broken — the surrounding emptiness reads as "this isn't built for me." Code comments in `components/screens/Duel.tsx:24` already acknowledge the gap (*"the desktop side-by-side variant is deferred"*).

This plan delivers a **true responsive desktop layout** for every screen: not a wider phone, but a real desktop composition that respects era invariants (the whole product premise is the old/new split) while using the screen properly.

**Key benefits:**
- Desktop visitors get a layout that uses their screen — the Duel becomes a cinematic side-by-side face-off mirroring the Landing's left/right era split.
- Mobile experience is unchanged (no regression risk on the dominant device class).
- Implementation is CSS-only (no JS branching, no hydration concerns), aligned with the existing codebase pattern.

## Context (from discovery)

**Files involved:**
- `app/page.tsx` — owns `PAGE_FRAME_STYLE` (the 480px cap), wraps all screens.
- `app/globals.css` — design system; era skins, tokens, shape variants, animations, reduced-motion guards.
- `components/screens/Landing.tsx` — vertical era split, centered BrandMark + FIGHT CTA.
- `components/screens/Duel.tsx` — top/bottom stacked EraCards (intended-side-by-side on desktop).
- `components/screens/Verdict.tsx` — verdict result + 9-pick recap.
- `components/screens/Share.tsx` — share methods + canonical pick layout.
- `components/screens/UnlockMoment.tsx` — first-view-after-unlock celebration.
- `components/screens/ReturningVisitor.tsx` — verdict card + 9 picks for already-voted browser.
- `components/screens/Scoreboard.tsx` — `/scoreboard` standalone route.
- `app/r/[code]/page.tsx` — shared-link result page.

**Related patterns found:**
- Heavy use of inline `style={{ ... }}` objects with literal pixel values (padding, gap, fontSize).
- Era split uses absolute-positioned `.era-old` / `.era-new` background halves with foreground content at `zIndex: 4`.
- No existing media queries except the `prefers-reduced-motion` guard at the bottom of `globals.css`.
- `data-btn-shape="banner"` / `data-card-shape="tomb"` on `<html>` — the only locked shape variant pair (Q12B).

**Dependencies identified:**
- `EraCard` (uses `.fighter-card` skeleton with `.fc-portrait` at `aspect-ratio: 4/5`).
- `BrandMark` accepts `vertical` prop + `size` for type-scale control.
- `VsSeam` renders a divider between cards — `vertical` prop today means "stacked, so seam is horizontal." On desktop side-by-side, callers will omit `vertical` (or we audit its semantics — see Task 3).

## Development Approach

- **Testing approach**: Regular (manual visual verification, no e2e/unit tests for layout)
  - Rationale: CLAUDE.md explicitly says *"Don't unit-test visual components. The design is the spec; visual regression isn't worth maintaining at this scale."* The existing mobile Playwright happy-path tests stay as the regression net for behavior — layout changes that don't break behavior are out of scope for them.
  - **Manual verification per screen**: open `npm run dev`, hit each screen at three viewport widths: 390px (mobile baseline), 900px (the layout-flip boundary), 1440px (typical desktop). Confirm no regression on mobile and the desktop layout reads correctly.
- Complete each task fully before moving to the next.
- Make small, focused changes — one screen per task, easy to revert.
- **CRITICAL: every task ends with manual visual verification at all three viewport widths** before starting the next task.
- **CRITICAL: update this plan if scope changes during implementation.**
- Maintain mobile-first as the default; desktop is a progressive enhancement layer.
- **Preserve era-skin invariants** (CLAUDE.md): never harmonize old/new. Every desktop layout must keep the era split visually distinct.
- **Preserve `--split` scaling**: any new era-treatment effect respects `--split`.
- **Preserve reduced-motion guards**: any new animation adds its own `@media (prefers-reduced-motion: reduce)` clause.

## Testing Strategy

- **Unit tests**: none for layout — see CLAUDE.md "pragmatic testing posture."
- **E2E tests**: existing mobile Playwright tests must keep passing (regression check after every task). Do NOT add desktop-viewport e2e — out of scope per user decision.
- **Manual visual check** (mandatory per task): three viewports — 390 / 900 / 1440 — for the screens touched in that task.

## Progress Tracking

- Mark completed items with `[x]` immediately when done.
- Add newly discovered tasks with ➕ prefix.
- Document issues/blockers with ⚠️ prefix.
- Update plan if implementation deviates from original scope.

## Solution Overview

**Strategy: CSS-only fluid + single layout-flip breakpoint.**

1. **Fluid type and spacing** — replace fixed pixel values (`fontSize: 22`, `padding: '48px 24px'`, `gap: 28`) with `clamp(min, preferred, max)` so the design scales smoothly from mobile to desktop without a hard step.
2. **Layout-flip media query at `min-width: 900px`** — at this boundary:
   - Remove the 480px page-frame cap (the frame becomes the viewport).
   - Duel's two EraCards reflow from `flex-direction: column` to `row` (side-by-side).
   - Landing's centered column gets more breathing room and a larger CTA.
   - Verdict/Share/UnlockMoment/ReturningVisitor get wider content columns capped at a readable max-width (~720–900px) so long-form content doesn't span the full viewport.
3. **Era backdrop already works** — Landing and Duel both use absolute `<div className="era-old" style={{ flex: 1 }} />` halves, which naturally fill the viewport at any width. No backdrop work needed.

**Why this fits:**
- Aligned with the existing codebase: globals.css already centralizes design tokens; inline styles already handle layout per-screen. Adding clamp() to inline styles and a small set of media queries in globals.css extends what's there rather than introducing a new pattern.
- SSR-clean: no `window` reads, no hydration mismatch, no flicker.
- Mobile-first preserved: the desktop styles are an `@media (min-width: 900px)` enhancement layer that doesn't touch the existing mobile path.

**Cards-sizing decision (Task 3, Duel):** "Match the design's read" — cards capped at ~480×600 each with generous gap. Chosen over "cinema-scale" to avoid pushing the NEXT CTA below the fold on shorter desktop viewports, and to preserve the existing chrome/proportion the design system already tunes for.

## Technical Details

**The 480px lock** — `app/page.tsx:49`:
```ts
const PAGE_FRAME_STYLE = {
  maxWidth: 480,    // ← this is the only thing preventing desktop
  margin: '0 auto',
  ...
};
```
Will become:
```ts
const PAGE_FRAME_STYLE = {
  width: '100%',
  minHeight: '100vh',
  position: 'relative' as const,
  background: '#000',
  overflow: 'hidden' as const,
};
```
The `maxWidth: 480` + `margin: '0 auto'` are removed. Each screen is now responsible for its own content max-width (using inline styles + clamp), because the right max-width varies by screen (Landing: narrow center column; Verdict: 720–900px reading column; Duel: full viewport with cards capped individually).

**Layout-flip helper (in globals.css):**
```css
/* Desktop layout flip — Duel goes side-by-side. */
@media (min-width: 900px) {
  .duel-cards {
    flex-direction: row !important;
    gap: clamp(16px, 3vw, 48px);
    align-items: stretch;
    justify-content: center;
  }
  .duel-card-slot {
    flex: 0 1 480px;
    max-width: 480px;
  }
}
```
Each screen adds the class names it needs to its existing inline-styled wrappers; CSS in globals.css does the heavy lifting.

**Clamp pattern for fluid type/spacing:**
```ts
// Before:
style={{ padding: '48px 24px', fontSize: 22, gap: 28 }}
// After:
style={{
  padding: 'clamp(32px, 5vw, 80px) clamp(16px, 4vw, 48px)',
  fontSize: 'clamp(18px, 3vw, 32px)',
  gap: 'clamp(20px, 3vw, 48px)',
}}
```

**Override policy — inline styles vs media queries (load-bearing):**

The codebase uses inline `style={{}}` heavily. Inline styles always beat class selectors on specificity, so a media-query rule on a class CAN'T override an inline value without `!important`. Policy:

1. **For values that differ between mobile and desktop** (padding, gap, fontSize, width caps): change the inline value to a `clamp()` expression. Single source, no media query needed, no `!important`.
2. **For properties `clamp()` can't express** — i.e. `flex-direction` flips, `display` toggles, conditional `max-width` removal: use `@media (min-width: 900px)` in globals.css with `!important`, and apply a stable class to the target element.
3. **DO NOT** do a wholesale "move all styles into globals.css" refactor — out of scope. Only the wrappers that need layout-flip behavior get a className (e.g. `.duel-cards`).

This keeps the strategy unambiguous: clamp first, `!important` only for layout flips.

**Persistent overlay positioning (`MuteToggle`, `DisclaimerRibbon`):**

`MuteToggle` is `position: fixed; right: 12; bottom: 12;` (`components/MuteToggle.tsx:20-22`). `DisclaimerRibbon` is bottom-fixed. Today both sit visually inside the 480px frame because the viewport is small. After Task 1 lifts the cap, both overlays anchor to the viewport edge — which is the correct, expected behavior for fixed-position chrome (mute toggles always sit in a viewport corner; ribbons span the screen). **Decision: keep fixed-to-viewport. No code change for the overlays themselves.** Documented here so the implementer doesn't second-guess it.

## What Goes Where

- **Implementation Steps** (`[ ]` checkboxes): all code changes — `app/page.tsx`, `app/globals.css`, each screen file. All within this repo.
- **Post-Completion** (no checkboxes): manual cross-browser check on a real desktop, social-share screenshot regeneration if needed, deciding whether to add desktop screenshots to the repo's design handoff.

## Implementation Steps

### Task 1: Lift the 480px page-frame cap and add layout helpers in globals.css

**Files:**
- Modify: `app/page.tsx`
- Modify: `app/globals.css`

- [ ] In `app/page.tsx`, change `PAGE_FRAME_STYLE` to drop `maxWidth: 480` and `margin: '0 auto'`; keep `width: '100%'`, `minHeight: '100vh'`, `position: 'relative'`, `background: '#000'`, `overflow: 'hidden'`.
- [ ] In `app/globals.css`, add a new section "Desktop layout" near the bottom (before the `prefers-reduced-motion` block) introducing the `.duel-cards`, `.duel-card-slot`, and `.content-column` classes. The full block:
  ```css
  /* Desktop layout flip — Duel goes side-by-side. */
  @media (min-width: 900px) {
    .duel-cards {
      flex-direction: row !important;
      gap: clamp(16px, 3vw, 48px);
      align-items: stretch;
      justify-content: center;
    }
    .duel-card-slot {
      flex: 0 1 480px !important;
      max-width: 480px;
    }
    .duel-seam-h { display: none !important; }   /* hide horizontal seam (mobile) */
    .duel-seam-v { display: flex !important; }   /* show vertical seam (desktop) */
  }
  /* Mobile default: hide the desktop-only seam. */
  .duel-seam-v { display: none; }

  /* Reading-column cap — applied to wrapper of long-form screens. */
  .content-column {
    max-width: clamp(390px, 90vw, 720px);
    margin-inline: auto;
  }
  ```
- [ ] No code change for `MuteToggle` or `DisclaimerRibbon` — keeping fixed-to-viewport per the documented decision in Technical Details. Confirm by inspecting both after lifting the cap: they should sit in the viewport corners.
- [ ] Verify no `@media` block clashes with the existing `prefers-reduced-motion: reduce` block; new media queries go above it.
- [ ] Manual verify at 390 / 900 / 1440px on Landing only (other screens not updated yet — they'll just sit full-width-with-existing-layout, which may look broken until their task; that's expected).

### Task 2: Landing — fluid scale + larger desktop CTA

**Files:**
- Modify: `components/screens/Landing.tsx`
- Modify: `components/BrandMark.tsx`

- [ ] In `components/BrandMark.tsx`, widen the `size` prop type from `number` to `number | string`. Verified by reading the file: `size` is consumed only as `fontSize: size` on line 20 — React accepts a string `fontSize` (e.g. `'clamp(28px, 4vw, 48px)'`) without further changes.
- [ ] In `Landing.tsx`, replace fixed values in the foreground content wrapper (`padding: '48px 24px'`, `gap: 28`) with `clamp()` values that scale up on wider viewports.
- [ ] Update the `<BrandMark size={28} vertical />` call to `size="clamp(28px, 4vw, 48px)"` so the lockup scales on wider viewports.
- [ ] Scale the FIGHT button `fontSize: 22` and `padding: '22px 56px'` via `clamp()` so it reads as a hero CTA on desktop without becoming gargantuan.
- [ ] Optionally widen the centered content column on desktop by adjusting `padding` — confirm the FIGHT button stays centered and the era split (left old, right new) still reads as the dominant visual.
- [ ] Manual verify at 390 / 900 / 1440px: era split intact, BrandMark centered on the seam, FIGHT CTA legible and clearly the focal point, fine-print line not crowded.

### Task 3: Duel — side-by-side cards on desktop

**Files:**
- Modify: `components/screens/Duel.tsx`

**Actual DOM (verified, `Duel.tsx:188-243`):**
```
<div flexDirection: 'column'>                ← THIS gets className="duel-cards"
  <div style={{ display: 'flex' }}>           ← THIS gets className="duel-card-slot"
    <EraCard era="old" style={{ flex: 1 }} />
  </div>
  <VsSeam vertical />                         ← Mobile-only seam (horizontal divider)
  <div style={{ display: 'flex' }}>           ← THIS gets className="duel-card-slot"
    <EraCard era="new" style={{ flex: 1 }} />
  </div>
</div>
```
Three siblings, NOT two-children-with-seam-between. The VsSeam is itself a child of the wrapper. Both EraCards already have `style={{ flex: 1 }}` which works in either flex direction.

**Era convention (locked):** old-LEFT, new-RIGHT on desktop side-by-side, matching the Landing's vertical era-split convention (`Landing.tsx:61-62`). The current DOM ordering already produces this (old first, new last) — preserve that order.

- [ ] Add `className="duel-cards"` to the outer column wrapper (`Duel.tsx:188-197`). Keep its inline `flexDirection: 'column'` — the globals.css rule will `!important` flip it to `row` at ≥900px.
- [ ] Add `className="duel-card-slot"` to BOTH `<div style={{ display: 'flex' }}>` wrappers (`Duel.tsx:198, 222`). On mobile no effect; on desktop the rule applies `flex: 0 1 480px !important; max-width: 480px;` so each card slot caps at 480px wide.
- [ ] **VsSeam swap.** Render TWO seams instead of one — one mobile-only (horizontal divider), one desktop-only (vertical divider). Smallest change:
  ```tsx
  <div className="duel-seam-h"><VsSeam vertical /></div>
  <div className="duel-seam-v"><VsSeam vertical={false} /></div>
  ```
  Both classes are defined in globals.css (Task 1): `.duel-seam-v` is `display: none` by default, becomes `flex` at ≥900px; `.duel-seam-h` flips the other way. This avoids any prop-juggling and keeps `VsSeam` itself unchanged.
- [ ] Scale the character-name headline (`fontSize: 30`, `Duel.tsx:175`) via `clamp()` (e.g. `clamp(30px, 5vw, 64px)`) so it reads bigger on desktop.
- [ ] Scale the top progress / year-lockup row spacing via `clamp()` where it helps (`Duel.tsx:104` padding, `137-138` gap).
- [ ] **NEXT button visibility check.** Duel's outer container is `minHeight: '100vh'` with the inner card stage using `flex: 1`. On a 1440×900 desktop viewport with cards capped at 480×600 side-by-side, the card stage's `flex: 1` consumes vertical slack and the NEXT button stays visible — confirm by manual verification.
- [ ] **Fallback if NEXT goes below the fold at ≥900px:** cap the card stage's height by adding `maxHeight: 'clamp(400px, 70vh, 700px)'` inline on the `.duel-cards` wrapper at desktop sizes. Don't pre-emptively add this — only if manual verification at 1440×900 shows it's needed.
- [ ] Manual verify at 390 / 900 / 1440px: at <900px stacked layout unchanged (horizontal VsSeam between cards); at ≥900px cards side-by-side with vertical VsSeam between, old-left/new-right, no horizontal scroll, NEXT button visible at 768px+ viewport heights.
- [ ] Run existing Playwright e2e to confirm no regression: `npx playwright test`. Pay attention to the duel-screen test selectors (`duel-screen`, `vs-seam`) — rendering two `VsSeam` components means `data-testid="vs-seam"` now matches two elements. If any test uses `getByTestId('vs-seam')` expecting exactly one, update it to use `getAllByTestId` or scope to the visible one.

### Task 4: Verdict — reading column on desktop

**Files:**
- Modify: `components/screens/Verdict.tsx`

**Known anchors (verified):**
- The screen wrapper at `Verdict.tsx:113-122` has `width: '100%'; minHeight: '100vh'` — no max-width cap of its own. Good.
- The inner content column at `Verdict.tsx:136-147` has `padding: '24px 20px 20px'; gap: 14; minHeight: '100vh'` — fixed values to clamp.
- **The verdict card itself uses container queries.** `Verdict.tsx:183-189` sets `width: 'min(82%, 360px)'` with `containerType: 'inline-size'`. The card's internal typography (`cqw`-based) self-scales with its container — so widening the `width` cap automatically scales the whole card up. This is the single most important change for the Verdict screen.

- [ ] Add `className="content-column"` to the inner content wrapper (`Verdict.tsx:136`) so the content caps at ~720px on wide viewports and stays centered.
- [ ] Change the card stage `width: 'min(82%, 360px)'` (`Verdict.tsx:184`) to a desktop-scaled value, e.g. `width: 'min(90%, 540px)'` or `width: 'clamp(280px, 60vw, 560px)'`. Pick the value that reads best in manual verification. The cqw-based card type will scale automatically.
- [ ] Replace fixed values in the inner wrapper (`padding`, `gap`) with `clamp()`.
- [ ] Scale the header type (`fontSize: 9, 14` at `Verdict.tsx:152, 159`) modestly via `clamp()` if needed.
- [ ] CTA grid `gridTemplateColumns: '1fr 1fr'` at `Verdict.tsx:196` is fine on desktop — keep two-column.
- [ ] Manual verify at 390 / 900 / 1440px: card visibly larger on desktop, content stays centered, CTAs side-by-side.

### Task 5: Share — desktop layout

**Files:**
- Modify: `components/screens/Share.tsx`

- [ ] Read `components/screens/Share.tsx` fully.
- [ ] Apply the `.content-column` cap to the main content wrapper.
- [ ] Replace fixed type/padding/gap with `clamp()`.
- [ ] If share method buttons are stacked vertically on mobile, consider a horizontal row on desktop. Smallest change wins.
- [ ] Confirm OG image preview / canonical-pick layout still reads correctly.
- [ ] Manual verify at 390 / 900 / 1440px.

### Task 6: UnlockMoment — desktop layout

**Files:**
- Modify: `components/screens/UnlockMoment.tsx`

- [ ] Read `components/screens/UnlockMoment.tsx` fully.
- [ ] Apply `.content-column` cap and `clamp()` scaling.
- [ ] If there's a celebratory hero element (per the screen's name), scale it up more aggressively on desktop than body text.
- [ ] Confirm any animations have a `prefers-reduced-motion` guard (CLAUDE.md invariant). Add one if missing.
- [ ] Manual verify at 390 / 900 / 1440px.

### Task 7: ReturningVisitor — desktop layout

**Files:**
- Modify: `components/screens/ReturningVisitor.tsx`

- [ ] Read `components/screens/ReturningVisitor.tsx` fully.
- [ ] Apply `.content-column` cap and `clamp()` scaling to the verdict card + 9 picks recap.
- [ ] Same grid-layout consideration as Verdict (Task 4) — keep changes minimal.
- [ ] Manual verify at 390 / 900 / 1440px.

### Task 8: Scoreboard — desktop layout

**Files:**
- Modify: `components/screens/Scoreboard.tsx`
- Modify: `app/scoreboard/page.tsx` (read first to confirm its own wrapper)

**Known anchors (verified):**
- `Scoreboard.tsx:61` has `maxWidth: 640` inline on the inner content wrapper. **This will silently override any class-based cap** (inline > class specificity). Must be removed or widened inline.
- `app/scoreboard/page.tsx` needs auditing — if it wraps Scoreboard in its own frame with a 480px cap, lift it the same way as `PAGE_FRAME_STYLE`.

- [ ] Read `app/scoreboard/page.tsx` fully. If it has a `maxWidth: 480` (or any) cap on its outer wrapper, lift it the same way as Task 1.
- [ ] In `Scoreboard.tsx:61`, **replace the inline `maxWidth: 640`** with `maxWidth: 'clamp(390px, 95vw, 900px)'` directly — don't try to override via class. The scoreboard benefits from more horizontal room (9 rows with bars).
- [ ] Replace fixed type/padding/gap values (`padding: '32px 24px 24px'`, `gap: 20`, the `fontSize: 40` heading at line ~95) with `clamp()`.
- [ ] If the 9 rows are vertically stacked (verify by reading lines 100+), no layout change needed — wider rows are the desktop improvement. If they're a grid, just let them breathe.
- [ ] Manual verify at 390 / 900 / 1440px.

### Task 9: /r/[code] result page — desktop layout

**Files:**
- Modify: `app/r/[code]/page.tsx`

**Known anchors (verified):**
- `app/r/[code]/page.tsx:142-153` has its OWN inline cap on the `<main>` element — `maxWidth: 480, margin: '0 auto', overflow: 'hidden'` — independent of `PAGE_FRAME_STYLE`. **Task 1's lift does NOT apply here.** Must be removed explicitly.
- The card stage at `app/r/[code]/page.tsx:213-223` uses the same `width: 'min(82%, 360px)'` + container-query pattern as Verdict. Same fix.

- [ ] **Remove the `maxWidth: 480` cap** from the `<main>` style at `app/r/[code]/page.tsx:142-153`. Keep `position: 'relative'; width: '100%'; minHeight: '100vh'; background: '#000'; overflow: 'hidden'`. Drop `maxWidth` and `margin: '0 auto'`.
- [ ] Change the card stage `width: 'min(82%, 360px)'` (`app/r/[code]/page.tsx:216`) to a desktop-scaled value matching Task 4's choice for Verdict (e.g. `width: 'min(90%, 540px)'`). Keep the two pages visually consistent — they share the same VerdictCard.
- [ ] Add `className="content-column"` to the inner content wrapper at `app/r/[code]/page.tsx:168-179` so the centered column is bounded on wide viewports.
- [ ] Replace fixed `padding`, `gap`, and header `fontSize` values with `clamp()`.
- [ ] Confirm the canonical-pick decode still renders correctly (no behavior change, layout only).
- [ ] Manual verify at 390 / 900 / 1440px: `/r/<some-valid-code>` no longer renders inside a 480px frame; card scales to match Verdict.

### Task 10: Verify acceptance criteria

- [ ] All 7 screens + `/r/[code]` + `/scoreboard` render correctly at 390 / 900 / 1440px.
- [ ] No horizontal scrollbar at any viewport.
- [ ] Era skins still distinct at all viewport widths (CLAUDE.md invariant). Specifically: on Duel at ≥900px the left half is era-old (warm cream/gold/crimson), right half is era-new (cold slate/lightning), no harmonization.
- [ ] **`--split` scaling check via DevTools** (the slider is not exposed in v1 UI). At 1440px viewport, open DevTools console and run `document.documentElement.style.setProperty('--split', '1.6')` — grain, chromatic split, tape-track, and halftone should all become more pronounced. Reset with `'1'`. Confirms desktop sizes don't break the `--split` contract.
- [ ] Reduced-motion: with `System Preferences → Accessibility → Reduce motion` on, tilt + tape-tracking + any new animations are suppressed at all viewport sizes.
- [ ] Run full Playwright e2e: `npx playwright test` — all existing mobile happy-path tests still pass. If Task 3's two-VsSeam change broke any test, fix the selector (use `getAllByTestId('vs-seam')` or scope to the visible one via CSS visibility check).
- [ ] Run unit tests: `npx vitest run` — all pass.
- [ ] Run typecheck: `npx tsc --noEmit` — clean.
- [ ] Run lint: `npx eslint .` — clean.

### Task 11: [Final] Update docs and move plan

- [ ] Update `CLAUDE.md` if any new patterns warrant capture — likely a one-line note under a new "Desktop layout" section: *"Layout flip at `@media (min-width: 900px)`. Fluid type/spacing via `clamp()`. Era invariants apply at all viewport widths — never harmonize the split, even on wide screens."*
- [ ] If `README.md` mentions "mobile-only" anywhere, update it.
- [ ] Move this plan to `docs/plans/completed/20260524-desktop-layout.md` (`mkdir -p docs/plans/completed` first).

## Post-Completion

*Items requiring manual intervention or external systems — informational only.*

**Manual verification:**
- Open the production deploy on a real desktop browser (Chrome, Safari, Firefox) at multiple viewport widths and confirm the era split reads as cinematic, not as "a phone screenshot with a wide background."
- Check on a real tablet (iPad portrait/landscape) — portrait should fall on the mobile side of the 900px boundary, landscape on the desktop side. Confirm both read correctly.
- Test the share flow end-to-end on desktop: complete a run, hit Share, confirm the share-method buttons all work (copy, native, download, X, Instagram, TikTok).

**External systems (if applicable):**
- If the design handoff repo (`design_handoff_old_blood_new_blood/`) is referenced for desktop variants, consider whether the new desktop layouts warrant a screenshot update.
- No deploy config changes needed — this is a pure frontend layout change. The existing Vercel deploy picks it up automatically.
