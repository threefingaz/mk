# CLAUDE.md — Patterns to Preserve

Instructions for future agentic editors working on this codebase. These patterns are load-bearing — break them and the product breaks. Read this file before making non-trivial changes.

## Era-skin invariants

`[data-era="old"]` and `[data-era="new"]` apply distinct visual treatments (color tokens, type, animations, grain, audio character). They are intentionally divergent — **never harmonize them**. The whole product premise is that the two eras feel different.

If you find yourself "simplifying" by unifying era styles, stop. That's not a refactor — that's deleting the product.

## `--split` contract

CSS custom property `--split` scales all era-treatment effects. Valid range: `0.5` / `1.0` / `1.6`. **Ship v1 at `1.0`**. Lower values mute the era split; higher values exaggerate it. Any new era-skin effect must respect `--split` so the global control still works.

## `prefers-reduced-motion: reduce`

Animations and audio default off when the user prefers reduced motion. Three load-bearing locations:

- `hooks/useTilt.ts` — tilt animation suppressed.
- `lib/audio.ts` — audio playback suppressed.
- `app/globals.css` (bottom `@media (prefers-reduced-motion: reduce)` block) — CSS animations suppressed.

**Never remove these guards.** Accessibility is non-negotiable. New animations or audio sources must add their own guard.

## KV key naming

Stable scheme — clients and rate limiters both depend on it:

| Key pattern | Purpose |
|---|---|
| `mk:<matchup>` | Per-matchup vote counters. |
| `mk:plays` | Completed-run counter (only `/api/complete` increments). |
| `mk:unlocked` | Boolean cache of whether the scoreboard has unlocked. |
| `seen:<runId>` | Idempotency marker for `/api/complete`. 24h TTL. Set via SET NX so concurrent requests with the same runId can't both claim the slot. |
| `ratelimit:vote:*` | Sliding-window rate limiter for `/api/vote`. |
| `ratelimit:complete:*` | Sliding-window rate limiter for `/api/complete`. |

Keep this scheme. Renames orphan existing prod data.

## Share-code format

`encodeShareCode` / `decodeShareCode` (in `lib/share-code.ts`) pack the 9 picks bits into a 2-byte payload (`bits 0..8 = pick[i] === 'old'`, bits 9..15 reserved-zero) and emit 3 base64url characters.

**No version byte.** The plan's locked-decision text mentions "version byte + 9 bits", but the implementation deliberately omits it — a version byte without a routing mechanism is premature generalization. Future format changes route via URL prefix (e.g. `/r2/<code>` for v2) so old and new codes never share a decoder. The load-bearing Q5 contract is "picks only, defied count computed live, pre-unlock shares auto-upgrade" — that remains intact.

**Important**: the encoder takes picks in **canonical FIGHTERS order**, not session-shuffled order. Callers with a shuffled `order: number[]` must remap: `canonicalPicks[order[i]] = picks[i]` before calling `encodeShareCode`. `/r/[code]` and `/api/og` decode against canonical `[0..8]` so the fighter→pick pairing only matches if the encoder honored this contract (see `components/screens/Share.tsx::buildCanonicalPicks`).

When the format changes in the future:

1. Route the new format via a new URL prefix (`/r2/`, `/r3/`, …) — don't try to multiplex versions through `/r/`.
2. The wire format must remain unambiguous (the decoder checks reserved bits 9..15 are zero — any set reserved bit is rejected as garbage).
3. `decodeShareCode` MUST reject malformed input (throw — never silently misinterpret).
4. Old short codes in the wild keep working at their original URL prefix, or stop resolving cleanly. Never half-decode.

## "Drop assets in later" pattern

Portraits (`public/portraits/<id>-<era>.jpg`) and audio (`public/audio/`) are **explicitly optional**. The app must function fully without them:

- Missing portrait → `<Silhouette>` SVG fallback. No console error.
- Missing audio file → silent playback. No console error. No UI failure.

If you add a new asset type, follow the same pattern: silent fallback, no breakage, no log noise.

## Persistence split

Two storage layers, never merged:

- **`sessionStorage`** — in-progress run state: `runId`, `order`, `step`, `picks`. Cleared when the tab closes; lets refresh-mid-run resume.
- **`localStorage`** — settled identity: `muted`, `hasVoted`, `priorRun`, `voted:<matchup>` flags. Persists across sessions; enforces one-run-per-browser and per-matchup vote dedup.

Don't merge them. The split is what makes the UX correct.

## No `RUN AGAIN`

**One run per browser** (interview Q2). The `RUN AGAIN` button was deliberately removed. `ReturningVisitor` shows the verdict card and the 9 picks — no replay flow. Don't reintroduce replay; the product is a one-shot poll, not a game.

## Pragmatic testing posture

- **Unit-test pure logic**: archetype math, share-code encoding/decoding, KV adapter, reducers.
- **Playwright smoke for happy paths**: landing → 9 picks → verdict → share.
- **Don't unit-test visual components.** The design is the spec; visual regression isn't worth maintaining at this scale.

## Resilience contract

The frontend is **never blocked by network**. Silent failures throughout:

- `/api/results` fail → synthesized payload `{ unlocked: false, plays: 0, threshold: 30, stats: undefined }`. (`stats` is omitted — `undefined` is the explicit "we have no data" signal that callers fall back on via `?? {}`.)
- `/api/vote` fail → fire-and-forget.
- `/api/complete` fail → 3× backoff (500ms / 2s / 5s), then local-only fallback. Idempotency key = `runId`.

Every new network call must follow this contract: timeout, silent fallback, no UI blocking, no thrown errors that reach the user.

### Known limitations

**`/api/complete` idempotency is best-effort, not transactional.** Two narrow race conditions can drop or mis-time a play counter increment under specific KV-failure timing:

1. **Post-increment unlock-flip failure.** If `incrementPlays` succeeds but `flipUnlocked` then throws, the seen-marker is intentionally NOT released. Releasing would let a retry re-claim and re-increment → double-count. We accept that the unlock flip is delayed by one completion cycle (the next successful run will see `plays >= REVEAL_AT && !unlocked` and flip it). Tracked in `app/api/complete/route.ts` via the `incremented` flag.

2. **Timed-out client retry receiving `idempotent: true`.** Client times out at 8s while the server is still processing the first attempt. The retry hits the server, sees the marker claimed, and returns `idempotent: true`. The client records `hasVoted` locally and stops retrying. If the first attempt then fails BEFORE `incrementPlays` completes, `releaseSeen` drops the marker — but the client is already done, so the play is permanently lost.

Truly fixing #2 requires a Redis transaction primitive (`MULTI`/`EXEC` or a Lua script) so "claim + increment" is atomic. Our KV abstraction (`@vercel/kv`-backed `lib/kv.ts`) doesn't expose that today, and the failure window is narrow enough (requires network-timeout-class server latency AND a pre-increment failure on the first attempt) that we accept it as the right trade-off for a fan poll. Acceptable failure mode: an occasional missed play count during rare KV instability.

## Desktop layout

Layout flip at `@media (min-width: 900px)`. Fluid type/spacing via `clamp()`. Era invariants apply at all viewport widths — never harmonize the split, even on wide screens.

- Mobile-first stays the default; the desktop layer is a progressive enhancement.
- `app/page.tsx::PAGE_FRAME_STYLE` no longer caps width — each screen owns its own content max-width via inline `clamp()` or the `.content-column` helper in `app/globals.css`.
- Inline `style={{}}` always wins on specificity. For values that differ across breakpoints, prefer `clamp()` over media queries; reserve `@media (min-width: 900px) { ... !important }` for properties `clamp()` can't express (e.g. Duel's `flex-direction` flip via `.duel-cards`). Don't sprinkle `!important` on rules that have no competing inline style — the only load-bearing `!important` in the desktop block is `flex-direction: row` on `.duel-cards`.
- `MuteToggle` is `position: fixed` and anchors to the viewport corner — don't constrain it to a content column. `DisclaimerRibbon` is NOT fixed; it renders inline as a normal-flow `<div>` at the bottom of the page and spans full width (since Task 1 lifted the page-frame cap). Don't wrap it in a content column either — full-bleed at the bottom is the intended treatment.

### Duel-specific helpers (load-bearing)

`components/screens/Duel.tsx` and `app/globals.css` are coupled by a small set of class names. Renaming any of them silently breaks the desktop layout flip.

- `.duel-cards` — outer wrapper around the two card slots. CSS flips `flex-direction` from `column` to `row` at >=900px. The inline style on the wrapper deliberately OMITS `gap` so the desktop CSS `gap: clamp(...)` rule takes effect (an inline `gap: 0` would override it on specificity).
- `.duel-card-slot` — wraps each `EraCard`. Mobile: no effect. Desktop: `flex: 1 1 400px; min-width: 0; max-width: 400px` so two slots + gap shrink to fit narrow desktop viewports without overflowing.
- `.duel-seam-h` / `.duel-seam-v` — the mobile-only horizontal seam and desktop-only vertical seam, respectively. CSS toggles `display` between them at the breakpoint. Duel renders BOTH `<VsSeam>` instances and passes distinct `testId="vs-seam-h"` / `testId="vs-seam-v"` so `getByTestId('vs-seam')` doesn't trip strict mode (the legacy `vs-seam` default is preserved for any caller that renders only one).

### Reading-column tokens

`.content-column` exposes shared scale tokens as CSS custom properties (`--col-pad-y-top`, `--col-pad-y-bot`, `--col-pad-x`, `--col-gap`, `--card-stage-w`) so Verdict / Share / ReturningVisitor / `/r/[code]` don't copy-paste the same `clamp()` tuples. Inline styles consume them via `var()`. UnlockMoment doesn't read these — it sets its own inline `padding: clamp(24px, 4vw, 48px) clamp(20px, 4vw, 40px)` (both axes clamped directly, not via the shared `--col-*` vars) — and Share/ReturningVisitor intentionally render a smaller verdict-card stage so they don't read `--card-stage-w`.

### Reduced-motion guard for UnlockMoment

UnlockMoment's celebratory animations (`reveal-up` headline, `glitch-x` eyebrow, `pulse-red` confetti / LIVE dot) are suppressed under `prefers-reduced-motion: reduce` by a guard in `app/globals.css` keyed on the `.unlock-celebration` class on the screen root. The class is load-bearing — `components/screens/UnlockMoment.test.tsx` anchors that contract. Rename one without the other and accessibility silently breaks.

## Shape variants — locked

`<html data-btn-shape="banner" data-card-shape="tomb">` is the only variant pair shipped. The alternate `chamfer` / `slab` / `skew` button rules and `chamfer` / `slab` card rules were stripped from `app/globals.css` (Q12B). Don't re-add them — the design system ships one shape pair on purpose.

## Analytics event taxonomy

7 typed custom events fire through `lib/analytics.ts::trackEvent`. Pageviews come automatically from `<Analytics />` in `app/layout.tsx`.

| Event | Props | Hook point |
|---|---|---|
| `run_start` | (none) | Landing FIGHT click |
| `pick` | `fighter_id`, `era`, `step` | Each duel pick |
| `run_complete` | `archetype`, `old_picks` | Verdict mount |
| `share_open` | (none) | Share screen mount |
| `share_click` | `method` ∈ {copy, native, download, x, instagram, tiktok} | Each share method click |
| `r_view` | (none) | `/r/[code]` mount |
| `unlock_moment_shown` | (none) | UnlockMoment mount |

Adding a new event: extend the `AnalyticsEvent` discriminated union in `lib/analytics.ts` so the call site gets exhaustive prop type checking.
