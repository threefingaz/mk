# Duel mobile side-by-side + tap-to-swap re-pick

## Overview

Restore the original mobile Duel layout (two cards side-by-side, separated only by the era-split background) and give the second tap on the duel screen real meaning by allowing the user to swap their pick before tapping NEXT.

**Problem solved:**
1. The current mobile Duel stacks cards vertically with a horizontal `<VsSeam>`. The original design (`design-reference/src/screens.jsx::DuelScreen` ~L173) used a CSS grid `1fr 1fr` so both eras are visible at once on mobile — the load-bearing "old vs new" comparison happens in a single glance, not via scroll.
2. The current flow is: tap a card to pick → tap NEXT to advance. The extra NEXT tap conveys no information today. Allowing the user to retap the *other* card to swap their pick (before NEXT) makes the second tap meaningful (confirm or reconsider).

**Integration with existing system:**
- Layout flip purely in `app/globals.css` (`.duel-cards`, `.duel-card-slot`, `.duel-seam-*`) plus a small render-shape tweak in `components/screens/Duel.tsx`.
- Re-pick semantics extend `recordPickAndSubmit` in `lib/store.ts` — the new behavior is additive (only relaxes the existing idle-only guard) and respects the per-matchup vote dedupe so no extra network traffic results.
- E2E happy-path unaffected; the existing test still picks once per duel and clicks NEXT.

## Context (from discovery)

Files involved:
- `components/screens/Duel.tsx` — render-shape: the two `EraCard` slots, the two `<VsSeam>` variants, and the `onPick` handler that currently bails when `picked` is truthy.
- `app/globals.css` (~L580-632) — `.duel-cards`, `.duel-card-slot`, `.duel-seam-h`, `.duel-seam-v` rules. Today the mobile baseline is flex column and the >=900px block flips to row.
- `lib/store.ts::recordPickAndSubmit` (~L175-207) — the side-effecting pick wrapper; bails when `duelState !== 'idle'` which currently blocks re-pick.
- `lib/store.test.ts` — has existing coverage for `recordPickAndSubmit` (vote dedupe, persistence). Add cases for swap and same-era idempotency.
- `e2e/duel-run.spec.ts` — unchanged behavior expectation; smoke verifies after changes.

Patterns found:
- "Clamp-first, `!important` only for layout flips" — currently `flex-direction: row !important` at >=900px is the only load-bearing `!important` in the desktop block, beating the inline `flexDirection: 'column'` on the wrapper. The layout inversion needed here: mobile becomes grid (not flex column), so the desktop block needs `display: flex !important` in addition to `flex-direction: row !important` to override the inline `display: grid` baseline.
- "Drop assets in later" / "Silent fallback" — N/A for this change but baseline behavior unchanged.
- `recordPickAndSubmit` already has dedupe-via-`votedMatchups` for the network call; the swap path reuses that — never re-submits.

Dependencies identified:
- `useIdentityStore.markVoted` / `votedMatchups` — must NOT re-call on swap (would corrupt the "first pick recorded server-side" contract).
- `next()` reads from `duelState` to derive the era for `picks` — so swapping `duelState` is sufficient to make the user's final pick reflect the swap, with no additional `picks` mutation needed.

## Development Approach

- **Testing approach**: Regular (code first, then tests) — the store change is small and amenable to writing the tests after the implementation lands. Manual UI verification at narrow viewports (320px / 360px / 414px / 900px breakpoint) is the load-bearing visual test; unit tests guard the store re-pick contract.
- Complete each task fully (impl + tests + manual viewport check where applicable) before moving on.
- Per CLAUDE.md "Pragmatic testing posture": unit-test pure logic (store), Playwright smoke covers happy path. No visual regression for the layout itself.
- After CSS changes: start the dev server and verify in a browser at narrow widths before reporting layout complete.

## Testing Strategy

- **Unit tests**: `lib/store.test.ts` gains two cases — swap (pick old, then pick new → duelState flips to pickedNew, no second `markVoted`/`submitVote`) and same-era idempotency (pick old, then pick old → no-op, no extra `submitVote` call).
- **E2E**: `e2e/duel-run.spec.ts` continues to pass unmodified. Adding a re-pick spec is *out of scope* — the happy-path smoke is enough per the project's pragmatic posture.
- **Manual viewport check**: load `/` in browser, drive through Landing → FIGHT → Duel. Verify at 320px, 360px, 414px, 899px (just below desktop break), and 900px (desktop break) that:
  - Cards render side-by-side with no central seam at all sub-900px widths.
  - At >=900px the existing desktop treatment (max-width 400px slot, vertical seam, max-height cap) still applies.
  - Tap a card → stamp appears, dim applies to the other, audio fires. Tap the OTHER card → stamp moves, dim swaps, audio fires for the new era. NEXT advances with the *latest* pick.
  - Tap the same card twice → second tap is a true no-op: no audio replay, no second `pick` analytics event, no visual jitter, no network request. (JSX same-era guard handles audio/analytics; store same-era guard is the correctness backstop.)
  - `prefers-reduced-motion` audio guard still suppresses re-pick audio (toggle in DevTools rendering panel) — verified via existing `lib/audio.ts` guard.

## Progress Tracking

- Mark completed items with `[x]` immediately on completion.
- Newly discovered tasks prefixed with ➕.
- Blockers prefixed with ⚠️.
- Sync this file when scope shifts.

## Solution Overview

**Layout (mobile):** Flip the mobile baseline from `flex-direction: column` to `flex-direction: row` with `gap: 6px` and `flex: 1` per slot. The two `<VsSeam>` slots stay rendered in the JSX (so the existing testIds keep matching) but `.duel-seam-h` becomes `display: none` at all viewports (it is no longer needed — the era-split background divides the two halves) and `.duel-seam-v` stays desktop-only.

**Layout (desktop >=900px):** Keep the existing desktop appearance (centered, slots capped at 400px, vertical seam visible, max-height clamp). Because the mobile baseline is now `flex-direction: row` (matches desktop's flex direction), the existing `flex-direction: row !important` becomes a no-op overlap at desktop — but keep it explicit anyway, since the inline style on the wrapper still says `flexDirection: 'row'`, and removing the `!important` would risk regression if a future maintainer changes the inline value back to `column`. Slot widths and max-height stay as today.

Update the inline wrapper style on `.duel-cards`: replace `flexDirection: 'column'` with `flexDirection: 'row'`, add `gap: 6` for the mobile baseline (desktop's `gap: clamp(16px, 3vw, 48px)` rule will override at >=900px because it has higher specificity than an inline shorthand-equivalent, and per CLAUDE.md's "clamp-first" policy we prefer the clamp). Keep `flex: 1` and `minHeight: 0` on the wrapper, and keep `display: 'flex'` (already implied; make it explicit for clarity).

**Why flex-row, not CSS grid?** Both achieve the same two-column layout at mobile widths. Flex was chosen for *specificity hygiene*: with a flex mobile baseline, the desktop block needs zero new `!important` rules — it just overrides `gap` and adds `max-height` / slot caps. A grid mobile baseline would have forced `display: flex !important` to win over the inline `display: 'grid'`, introducing a second load-bearing `!important` for no design benefit (grid `1fr 1fr` and flex `flex: 1` + `flex: 1` produce identical 50/50 columns when each slot has `min-width: 0`). Per CLAUDE.md's "`!important` only for layout flips" policy, this keeps the existing single `!important` declaration as the only specificity-override on `.duel-cards`.

**Note on `flex: 1` on the wrapper:** `flex: 1` is a flex-*item* property — it's load-bearing because `.duel-cards` is a child of the outer flex column (`Duel.tsx` L107: `display: 'flex', flexDirection: 'column'`). It tells the wrapper to fill the remaining vertical space inside that column. Inside `.duel-cards` itself, `flex: 1` on each `.duel-card-slot` does the actual 50/50 horizontal split. Two distinct flex contexts, both load-bearing.

**Re-pick semantics:** Two coordinated behavior changes:

1. **Store side** — relax `recordPickAndSubmit`'s idle-only guard so that calling it after a pick *with a different era* swaps `duelState` (no second `markVoted`, no second `submitVote`). Same-era retap is treated as a swap *target equals current* short-circuit (no-op).
2. **JSX side** — `Duel.tsx`'s `onPick` handler installs always (no `picked ? undefined : ...`), but the handler itself short-circuits at the *top* when the user retaps the already-picked card: skip audio, skip `trackEvent`, skip `recordPickAndSubmit`. The cross-era swap path goes through everything (audio replays for the new era, `trackEvent` fires with the new era — that's intentional signal that the user changed their mind).

This split is deliberate: the store guard is the *correctness* safety net (double-tap during a microtask race can't double-submit), and the JSX guard is the *UX* gate (no audio jitter on retap of the same card). Both are needed.

EraCard's `tabIndex` is already gated on `onPick` being truthy (`components/EraCard.tsx::L278`) — always passing the handler means the picked card stays keyboard-focusable, which matches the new "you can swap by keyboard" affordance. No EraCard changes needed.

## Technical Details

### `recordPickAndSubmit` contract change

Current (`lib/store.ts` ~L175-207):

```
if (state.duelState !== 'idle') return;            // bail
// ... markVoted + submitVote (if !alreadyVoted)
pick(era);                                          // sets duelState
```

New behavior — note the **fresh re-read** of `duelState` immediately before the same-era check (defensive against two taps queued in the same React event flush; mirrors the existing `useRunStore.getState()` calls already present at the bottom of the function):

```
const fresh = useRunStore.getState();              // re-read post any in-flight set()
const currentEra: Era | null =
  fresh.duelState === 'pickedOld' ? 'old' :
  fresh.duelState === 'pickedNew' ? 'new' : null;

if (currentEra === era) return;                     // same-era retap = no-op

if (currentEra === null) {
  // First pick this step — record vote (subject to per-matchup dedupe).
  if (!alreadyVoted) {
    markVoted(fighter.id, era);
    void submitVote(fighter.id, era, runId);
  }
}
// Both first-pick and swap paths reach here.
useRunStore.getState().pick(era);                  // sets/swaps duelState
```

The swap path:
- Does NOT call `markVoted` again (server vote is locked to first pick).
- Does NOT call `submitVote` again.
- DOES update `duelState`, which is what `next()` reads to decide which era to commit to `picks[step]`.

The same-era short-circuit also catches the bounce-tap race: if two taps for the same era queue in the same microtask, the first one calls `pick(era)` synchronously (Zustand `set` is sync), and the second's `useRunStore.getState()` re-read sees the updated `duelState` and short-circuits.

Caller (`Duel.tsx`):
- Always passes the `onPick` handler — never `undefined`.
- Handler short-circuits at the top when the user retaps the already-picked card: skip `unlockAudio`, skip `playOld*`/`playNew*`, skip `trackEvent`, skip `recordPickAndSubmit`. This is the UX no-op (no audio jitter).
- For first-pick AND cross-era swap: fires `trackEvent({ name: 'pick', ... })`, fires audio for the tapped era, calls `recordPickAndSubmit(era)`. The trackEvent on swap is intentional analytics signal (user changed their mind); downstream consumers should group by `(fighter_id, step)` and take the latest if they want "final pick" metrics.

Why the double guard (JSX same-era short-circuit + store same-era short-circuit)?
- JSX guard is the UX gate (no audio replay on harmless retap).
- Store guard is the correctness safety net (defensive against any future caller that forgets to gate).

### CSS layout

Mobile (`.duel-cards` rule — applies at all viewports as the new default):

```
.duel-cards {
  /* Mobile baseline: two cards side-by-side via flex-row, 6px gap.
     The era-split background is the only divider on mobile. */
  display: flex;
  flex-direction: row;
  gap: 6px;
  align-items: stretch;
  min-height: 0;
}
.duel-card-slot {
  display: flex;
  flex: 1;             /* mobile: 50/50 split between the two slots */
  min-width: 0;        /* allow each slot to shrink below its content width */
}
.duel-seam-h { display: none; }   /* never shown — era-split divides */
.duel-seam-v { display: none; }   /* desktop only */
```

Desktop (`@media (min-width: 900px)` block):

```
@media (min-width: 900px) {
  .duel-cards {
    /* flex-direction is already row on mobile — !important kept to defend
       against future inline-style regressions (e.g. if someone reintroduces
       flexDirection: 'column' on the wrapper). */
    flex-direction: row !important;
    gap: clamp(16px, 3vw, 48px);
    justify-content: center;
    max-height: clamp(400px, 70vh, 700px);
  }
  .duel-card-slot {
    /* Cap each slot at 400px on desktop so the duel doesn't span a 1440px
       viewport. Math + rationale unchanged from the existing comment. */
    flex: 1 1 400px;
    max-width: 400px;
  }
  .duel-seam-v { display: flex; }         /* show vertical seam on desktop */
  /* .duel-seam-h stays display:none */
}
```

Inline wrapper style (`Duel.tsx`):

```
className="duel-cards"
style={{
  flex: 1,
  display: 'flex',
  flexDirection: 'row',
  gap: 6,
  minHeight: 0,
}}
```

(`flex: 1` on the wrapper is a flex-*item* declaration relative to the outer column flex parent — it fills remaining vertical space inside the `Duel.tsx::L107` flex-column. Inside `.duel-cards`, `flex: 1` on each `.duel-card-slot` is the actual 50/50 horizontal split.)

### Why no additional `!important` is needed at >=900px

Mobile baseline is already `display: flex; flex-direction: row`. Desktop adds `gap`, `max-height`, and `justify-content` — none of which the inline style fights. The only inline-style override risk is `flex-direction`, which the existing `!important` already defends. Per CLAUDE.md's "`!important` only for layout flips" policy, we keep one `!important` declaration on `.duel-cards` (the same one as today) — the layout flip is preserved as a defensive guard against future inline-style regressions.

## What Goes Where

- **Implementation Steps** (`[ ]` checkboxes): CSS rewrite, store contract change, Duel handler change, unit tests, manual viewport verification, CLAUDE.md updates.
- **Post-Completion** (no checkboxes): Cross-browser tactile check (Safari iOS, Chrome Android — outside the dev environment).

## Implementation Steps

### Task 1: Store — allow re-pick swap

**Files:**
- Modify: `lib/store.ts`
- Modify: `lib/store.test.ts`

- [x] In `lib/store.ts::recordPickAndSubmit`, replace the `if (state.duelState !== 'idle') return;` guard with the swap-aware logic from "Technical Details" above. Be sure to re-read `useRunStore.getState()` fresh inside the function (call it `fresh`) and compute `currentEra` from `fresh.duelState` — not from the `state` captured at function entry — so a bounce-tap race during a single React event flush correctly short-circuits the second tap.
- [x] Update the inline comment above the guard so it describes the new contract (no-op on same-era retap; cross-era retap swaps duelState; server vote locked to first pick).
- [x] Add a `// Trade-off:` comment explaining that the server vote stays bound to the first pick (per-matchup dedupe) while the local archetype/share reflect the final swap — point at CLAUDE.md's "one-vote-per-matchup-per-browser" contract.
- [x] Add unit test (cross-era swap, old → new): `recordPickAndSubmit('old')` then `recordPickAndSubmit('new')` → `duelState === 'pickedNew'`, `submitVote` called exactly once with `'old'`, `markVoted` called exactly once with `'old'`, `pick` called exactly twice (once per tap).
- [x] Add unit test (cross-era swap, symmetric new → old): `recordPickAndSubmit('new')` then `recordPickAndSubmit('old')` → `duelState === 'pickedOld'`, `submitVote` called exactly once with `'new'`, `markVoted` called exactly once with `'new'`, `pick` called exactly twice.
- [x] Add unit test (same-era idempotency): `recordPickAndSubmit('old')` then `recordPickAndSubmit('old')` → `duelState === 'pickedOld'` unchanged, `submitVote` called exactly once, `markVoted` called exactly once, `pick` called exactly *once* (the second invocation must not re-call `pick(era)` either — proves the no-op is at the top of the function).
- [x] Add unit test (cross-step reset regression guard): `recordPickAndSubmit('new')` → `next()` → `recordPickAndSubmit('old')` → `duelState === 'pickedOld'`, `submitVote` called twice total (once per step) with the correct fighter id each time, `markVoted` called twice (once per matchup). This confirms that after `next()` resets `duelState` to `'idle'`, the next step's first pick is treated as a first-pick (not a swap).
- [x] Run `npm test -- lib/store.test.ts` — all pass before next task.

### Task 2: Duel.tsx — always wire onPick handler with same-era UX short-circuit

**Files:**
- Modify: `components/screens/Duel.tsx`

- [x] Change both `EraCard` `onPick` props from `picked ? undefined : () => { ... }` to always pass the handler. The store handles correctness; the JSX handles the UX no-op.
- [x] Inside each handler, add a *top-of-function* same-era guard: if `pickedOld` (for the old handler) / `pickedNew` (for the new handler), `return` immediately — skip `unlockAudio`, skip `playOld*` / `playNew*`, skip `trackEvent`, skip `recordPickAndSubmit`. This is the UX no-op (no audio jitter on retap of the same card).
- [x] Cross-era taps (e.g. tapping the new card after picking old) fall through the guard and execute the full handler: trackEvent → unlockAudio → impact/voice → recordPickAndSubmit. The audio replay for the new era is intentional — it confirms the swap audibly.
- [x] Add a one-line comment above the handlers: "Same-era retap short-circuits here for UX; the store also short-circuits as a correctness backstop." No other inline comments needed — the analytics-on-swap rationale lives in CLAUDE.md (Task 7).
- [x] No test changes in this task — covered by Task 1 store unit tests + Task 5 manual verification. (The JSX same-era guard is a pure UX gate; testing it would require a render harness that's heavier than the gate is worth.)
- [x] Run `npm run typecheck` (or project equivalent) — must pass before next task.

### Task 3: CSS — mobile flex-row baseline, desktop preserves max-width slot

**Files:**
- Modify: `app/globals.css`

- [x] Replace the existing mobile baseline `.duel-seam-v { display: none; }` line with the mobile block from "Technical Details > CSS layout":
  - `.duel-cards { display: flex; flex-direction: row; gap: 6px; align-items: stretch; min-height: 0; }`
  - `.duel-card-slot { display: flex; flex: 1; min-width: 0; }`
  - `.duel-seam-h { display: none; }`
  - `.duel-seam-v { display: none; }`
- [x] In the `@media (min-width: 900px)` block, simplify `.duel-cards`: keep `flex-direction: row !important;` (defends against future inline-style regression to `column`), keep `gap`, `justify-content`, and `max-height`. Drop `align-items: stretch;` from the desktop rule (now inherited from the mobile baseline). The existing `display` does NOT need an `!important` override — mobile baseline is already `display: flex`.
- [x] Simplify `.duel-card-slot` desktop rule: keep `flex: 1 1 400px;` and `max-width: 400px;`. Drop `min-width: 0;` (now in the mobile baseline). The desktop rule's role is to cap each slot at 400px on wide viewports.
- [x] Remove the line `.duel-seam-h { display: none; }` from the desktop block (already hidden globally now); keep `.duel-seam-v { display: flex; }`.
- [x] Update the block-comment above the desktop `.duel-cards` rule: "Mobile baseline is `display: flex; flex-direction: row` with a 6px gap and `flex: 1` per slot. Desktop overrides only `gap` (clamp), adds `justify-content: center`, and caps the stage height. The `flex-direction: row !important` is preserved as a defensive guard against any future inline-style regression that reintroduces `flexDirection: 'column'` on the wrapper — without that guard, an inline column value would silently revert mobile parity at desktop. Per CLAUDE.md's `!important`-only-for-layout-flips policy, this remains the single load-bearing `!important` on `.duel-cards`."
- [x] Update the block-comment above the mobile rules to call out: "Era-split background already divides the two halves on mobile — no central seam needed. Original design parity (`design-reference/src/screens.jsx::DuelScreen` ~L173, originally `gridTemplateColumns: 1fr 1fr; gap: 6`, implemented here as flex-row for specificity hygiene — see desktop block comment)."
- [x] No unit tests for CSS — covered by Task 5 manual viewport verification.

### Task 4: Duel.tsx — update wrapper inline style + comments

**Files:**
- Modify: `components/screens/Duel.tsx`

- [x] Update the inline `style` on the `.duel-cards` div: replace `flexDirection: 'column'` with `flexDirection: 'row'`, add `gap: 6`. Keep `flex: 1`, `display: 'flex'` (already implied — make it explicit), `alignItems: 'stretch'`, and `minHeight: 0`. Remove the long inline comment about "gap intentionally omitted" — it's no longer accurate; replace it with a 1-line comment: "Mobile baseline: flex-row with 6px gap. Desktop (>=900px) overrides `gap` to clamp(16,3vw,48px), adds slot max-width, and the `flex-direction: row !important` defends against inline-style regression."
- [x] Update the JSDoc-style comment block above the `.duel-cards` JSX (the one describing "Two EraCards — stacked on mobile, side-by-side at >=900px...") to describe the new behavior: "Side-by-side on all viewports. Mobile is a flex row with a 6px gap (era-split background is the only divider); desktop (>=900px) keeps the flex-row shape but adds a clamp gap, slot max-width cap (400px), and reveals the vertical `<VsSeam>` between the two cards. Matches the original design (`design-reference/src/screens.jsx::DuelScreen` ~L173)."
- [x] No test changes — covered by manual verification in Task 5.
- [x] Run `npm run typecheck` — must pass before next task.

### Task 5: Manual viewport verification

**Files:**
- (none — manual run)

- [x] Start dev server (`npm run dev` or project equivalent).
- [x] Open browser DevTools, set viewport to 320px wide. Drive landing → FIGHT → duel. Confirm: two cards side-by-side, no central seam, header/CTA readable, NEXT button reachable without overlap.
- [x] Repeat at 360px, 414px, 768px (still under desktop break), 899px.
- [x] Set viewport to 900px and 1280px. Confirm: vertical `<VsSeam>` appears, slots cap at 400px, max-height clamp keeps NEXT above the fold.
- [x] Tap a card → confirm stamp appears, other card dims. Tap the OTHER card → confirm stamp swaps, dim swaps, audio fires for the new era. Tap NEXT → advances to next fighter.
- [x] Tap same card twice → confirm second tap is a no-op (no audio replay, no visual jitter, no second vote in network panel).
- [x] Enable "Emulate CSS prefers-reduced-motion: reduce" in DevTools rendering panel. Re-pick. Confirm audio is suppressed and tilt is off (existing guards in `hooks/useTilt.ts` and `lib/audio.ts` still active).

### Task 6: Verify acceptance criteria

- [x] Mobile side-by-side restored (sub-900px). ✓ via Task 5.
- [x] No central seam on mobile. ✓ via Task 5.
- [x] Desktop layout (>=900px) unchanged in appearance. ✓ via Task 5.
- [x] Re-pick swap works; same-era retap is a no-op. ✓ via Task 1 unit tests + Task 5.
- [x] Server vote bound to first pick (no extra POST on swap). ✓ via Task 1 unit tests + Task 5 network panel check.
- [x] Reduced-motion guard still suppresses audio on swap. ✓ via Task 5.
- [x] Run full unit test suite: `npm test`.
- [x] Run e2e: `npm run test:e2e` (or project equivalent — likely `npx playwright test`). The existing `e2e/duel-run.spec.ts` must still pass unmodified.
- [x] Run typecheck + lint.

### Task 7: Update CLAUDE.md

**Files:**
- Modify: `CLAUDE.md`

- [x] Under "Desktop layout > Duel-specific helpers", update the `.duel-cards` description: "Side-by-side cards at ALL viewports (matches the original mobile design — `design-reference/src/screens.jsx::DuelScreen` ~L173). Mobile baseline is `display: flex; flex-direction: row; gap: 6px`. Desktop (>=900px) overrides `gap` to clamp, adds `justify-content: center` and the `max-height` cap, and caps each slot at 400px. The `flex-direction: row !important` is preserved as a defensive guard against any inline-style regression to `column` — it is the single load-bearing `!important` on `.duel-cards`."
- [x] Update the `.duel-seam-h` / `.duel-seam-v` description in the same section: "`.duel-seam-h` is always hidden (the era-split background is the only mobile divider — there is no central seam on mobile). `.duel-seam-v` is hidden on mobile and shown at >=900px between the two cards. Both `<VsSeam>` instances stay rendered in the JSX so the `getByTestId('vs-seam-h')` / `getByTestId('vs-seam-v')` selectors continue to resolve; visibility is purely CSS-controlled."
- [x] Add a new subsection under "Desktop layout" (or as a peer to "Persistence split") titled "Duel pick semantics — re-pick before NEXT": "Tapping a card sets your pick (`duelState` → `pickedOld`/`pickedNew`) and submits a vote to the server (subject to per-matchup dedupe). Tapping the OTHER card before NEXT swaps your local pick (and what `next()` commits to `picks[step]`) — but does NOT re-submit the server vote. The server vote stays bound to the first pick on each matchup, by design. Same-era retap is a no-op at both the JSX level (no audio, no analytics) and the store level (safety backstop). Don't reintroduce a `picked ? undefined : ...` guard on the EraCard `onPick` prop — that would break the swap affordance. Don't try to re-submit the vote on swap — the server's per-matchup dedupe would either drop it or, if dedupe is later changed, cause double-count drift."
- [x] Under "Analytics event taxonomy", add a one-line note to the `pick` row (or in a footnote below the table): "Fires on every tap, including cross-era retaps (intentional signal that the user changed their mind). Downstream consumers wanting 'final pick' metrics should group by `(fighter_id, step)` and take the latest event."
- [x] Move plan to completed: `mkdir -p docs/plans/completed && git mv docs/plans/20260524-duel-mobile-side-by-side.md docs/plans/completed/`.

## Post-Completion

**Manual verification on real devices** (outside the dev environment):
- Safari iOS at iPhone SE (320px-class) and iPhone 15 (393px). Confirm tap targets work, no double-tap zoom, audio unlocks on first tap (existing `unlockAudio()` call already on the path).
- Chrome Android at a typical 360px device. Same tactile checks.
- Confirm the era-split visual divider reads as a divider at these widths (the original design assumed it would; the dev viewport emulator usually agrees, but real OLED displays may render the bone/red transition differently).

**Trade-off accepted on record:**
- Server-recorded vote locks to the first tap on each matchup. A user who swaps will see their *local* pick (and therefore archetype + share code) reflect the swap, but the crowd-stats contribution stays bound to the first pick. This aligns with the existing "one-vote-per-matchup-per-browser" KV contract; documenting here so future agents don't try to "fix" it by re-submitting on swap (which would either be dedupe-skipped on the server or, worse, cause double-count drift if the dedupe is later changed).
