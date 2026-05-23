# OLD BLOOD // NEW BLOOD — Production Build

## Overview

Ship the fan-poll web app spec'd in `OLD_BLOOD_NEW_BLOOD_spec.md` and designed in `design_handoff_old_blood_new_blood/`. Players play 9 head-to-head "which is better?" duels between the 1995 Mortal Kombat cast and the 2026 reboot cast, then receive a shareable verdict card; aggregate crowd stats unlock once enough sessions have completed.

The design and prototype are already locked. The work is to **port the prototype into a Next.js App Router app on Vercel**, wire it to **Upstash KV** for crowd stats, and ship the **Open Graph virality layer** so shared URLs unfurl with the player's own verdict card.

Three phases (in order):

1. **Prototype on mock data** — visually complete, full state machine, archetype math, audio infrastructure. No backend; crowd stats mocked client-side.
2. **Real backend** — Upstash KV, `/api/vote` + `/api/complete` + `/api/results`, rate-limit, server-driven unlock, resilience layer.
3. **Virality layer** — short-code share URLs (`/r/[code]`), `@vercel/og` per-result preview images.

## Locked Decisions (from interview)

| # | Decision | Choice |
|---|---|---|
| Q1 | What counts as a "play" | One completed run = one play. `mk:plays` only increments on `/api/complete`. |
| Q2 | Replay model | **One run per browser, no replays.** `RUN AGAIN` removed. ReturningVisitor shows the verdict card + the 9 picks. |
| Q3 | Vote submission | Per-pick `POST /api/vote` (matchup counter) + separate `POST /api/complete` (bumps `mk:plays`). Per-matchup `voted:<matchup>` localStorage flags dedupe within a browser. |
| Q4 | `/r/[code]` visitor flow | Show friend's verdict only + `PLAY YOURSELF` CTA. No compare layer. |
| Q5 | Share code contents | Picks only (~4 chars, version byte + 9 bits). Defied count computed **live** against current crowd stats. Pre-unlock shares auto-upgrade once the board unlocks. |
| Q6 | Audio scope | Build full kit API (era impacts ×3 each, era voices, sting, bg loop); ship without sound files until they land — silent fallback identical to portraits. |
| Q7 | Error / offline behavior | Silent everywhere. `/api/results` fail → `unlocked: false, stats: {}`. `/api/vote` fail → fire-and-forget. `/api/complete` fail → 3× backoff (500ms / 2s / 5s) then local-only fallback. Idempotency key = `runId`. |
| Q8 | Rate limits | `@upstash/ratelimit` sliding window. `/api/complete` 5/IP/hr · `/api/vote` 120/IP/hr · `/api/results` uncapped. 429 = silent fallback. HMAC + votes-precede-completion = v1.5 hardening (Post-Completion). |
| Q9 | Mid-run refresh | Resume via sessionStorage. In-progress slice (`runId`, `order`, `step`, `picks`) persisted there; settled slice (`muted`, `hasVoted`, `priorRun`, `voted:<matchup>`) in localStorage. |
| Q10 | Environments | Two Upstash DBs (`mk-dev` / `mk-prod`). In-memory mock KV when creds absent (zero-config local dev). `REVEAL_AT=5` dev / `30` prod. Vercel previews auto-enabled on `mk-dev`. |
| Q11 | Analytics | Vercel Web Analytics (cookieless). 7 custom events: `run_start`, `pick`, `run_complete`, `share_open`, `share_click`, `r_view`, `unlock_moment_shown`, plus automatic pageviews. |
| Q12A | Domain | `<your-handle>.vercel.app` for Phases 1–2; register a real domain before Phase 3 ships (or ship Phase 3 on the Vercel domain — share URLs work either way). |
| Q12B | Shape variants | Strip `chamfer`/`slab`/`skew` button variants and `chamfer`/`slab` card variants from CSS. Ship `banner` + `tomb` only. |
| Q12C | Localization | English only at v1. |
| Q12D | SEO / robots | Basic only — generic `robots.txt` (allow all), no sitemap.xml, generic `<meta description>` on `/` and `/scoreboard`. |
| Q12E | Author credit | Anonymous launch. No about page. Author link can be added later in the disclaimer ribbon's right margin. |
| Q12F | Roster | Lock at 9. Goro/Reptile deferred. |
| Q12G | Archetype copy | Ship prototype copy as-is. Iterate during QA only if obviously off. |

## Context (from discovery)

- **Greenfield**: `/Volumes/X9/Code/MK` currently contains only the spec + design handoff; no `package.json`, no git repo, no Next.js app yet.
- **Design is locked**: `design_handoff_old_blood_new_blood/design-reference/styles.css` is the design system — OKLCH tokens, `era-old`/`era-new` skins, animations, shape variants. Lift wholesale, then strip unused shape variants (Q12B).
- **Prototype is React-shaped**: components in `design-reference/src/{system,cards,screens,run}.jsx` map 1:1 to Next.js client components. `app.jsx`, `design-canvas.jsx`, `tweaks-panel.jsx` are review-only and do NOT port.
- **9 fighters + 5 archetypes** are already data — `FIGHTERS` in `system.jsx`, `ARCHETYPE_SETS.A.items` in `cards.jsx`. Copy verbatim.
- **`<image-slot>` is replaced**: curated character portraits will be supplied later. Production uses a static portrait manifest (`/portraits/<id>-<era>.jpg`) with `<Silhouette>` SVG fallback when a file is missing.
- **Audio assets** follow the same "drop in later" pattern as portraits — full API surface ships now, files arrive later, missing files are silent.
- **Brand constraints**: persistent disclaimer ribbon, no trademarked marks, no monetization. Already in the design.

## Development Approach

- **Testing approach**: **Pragmatic — unit + smoke, no TDD**.
  - Unit-test the pure logic: archetype computation, contrarian count, share-code encode/decode, KV helpers, portrait resolver, rate-limit wrapper.
  - Skip unit tests on visual components; lean on Playwright specs that drive happy-path flows.
  - No tests written before code; tests added in the same task as the code they cover.
- Complete each task fully before moving to the next.
- Make small, focused changes.
- **CRITICAL: every task that adds logic MUST include unit tests for that logic.** Visual/styling-only tasks may skip tests but must be smoke-tested in the browser before marking complete.
- **CRITICAL: all tests must pass before starting the next task.**
- **CRITICAL: update this plan file when scope changes during implementation.**
- Run tests after each change.

## Testing Strategy

- **Unit tests** (Vitest): archetype math, run-result derivation, share-code encode/decode, portrait resolver, KV helpers (with mocked client), rate-limit wrapper, API route handlers (with mocked KV), resilience client (retry/backoff), audio module (variant rotation, silent-fallback on missing files, muted short-circuit, reduced-motion default-off).
- **e2e smoke** (Playwright):
  - Phase 1: `duel-run.spec.ts` — landing → 9 duels → verdict → share, archetype matches expected.
  - Phase 2: `backend.spec.ts` — vote/results/complete round-trip with Playwright route interception, pre/post-unlock branches, resilience layer fallback when /api/results returns 500.
  - Phase 3: `share-link.spec.ts` — `/r/[code]` renders the encoded picks, `/api/og?code=...` returns a 1200×630 PNG.
- e2e tests live in `e2e/`. Run with `npm run e2e`. Treat them with the same rigor as unit tests — must pass before the next task.

## Progress Tracking

- Mark completed items with `[x]` immediately when done.
- Add newly discovered tasks with ➕ prefix.
- Document issues/blockers with ⚠️ prefix.
- Update plan if implementation deviates from original scope.
- Keep plan in sync with actual work done.

## Solution Overview

**Single Next.js 15 App Router project deployed to Vercel.** One Vercel project, two Upstash KV databases (dev + prod), one domain (Vercel-provided for now).

- **Frontend** — React client components for every screen; one Zustand store with two persistence slices (sessionStorage for in-progress run state, localStorage for settled identity). The state machine lives in the store; `app/page.tsx` is a thin client component that switches on `phase`.
- **Styling** — `app/globals.css` imports a trimmed-down `styles.css` (alternate shape variants stripped). `<html data-btn-shape="banner" data-card-shape="tomb">` ships as the only variant pair. Fonts self-hosted via `next/font/google`.
- **Backend** — four serverless routes under `app/api/`:
  - `POST /api/vote` — validates `{matchup, choice, runId}`, increments KV counter, applies rate-limit, returns counts iff unlocked.
  - `POST /api/complete` — increments `mk:plays`, checks unlock flip, idempotent on `runId`.
  - `GET /api/results` — returns counts + `unlocked` boolean; withholds percentages until `REVEAL_AT`.
  - `GET /api/og` — edge runtime, `@vercel/og`, renders the 1200×630 verdict card from a decoded share code.
- **Resilience layer** — `lib/api-client.ts` wraps every call: `/api/results` failure → synthesized empty payload; `/api/vote` failure → swallowed; `/api/complete` failure → 3× exponential backoff then local-only completion. Idempotency key = `runId`.
- **Sharing** — share codes pack the 9 picks (binary, version byte + 9 bits, base64url) into a ~4-char code. `/r/[code]` decodes and renders the friend's verdict card with a `PLAY YOURSELF` CTA. OG image is server-rendered.
- **Audio** — full API surface in `lib/audio.ts`; sound files arrive later, missing files are silent. Default muted; unlocks on first tap; honors `prefers-reduced-motion: reduce` as a hint to keep audio off.
- **Curated portraits** — `public/portraits/<id>-<era>.jpg`. `<Portrait>` falls back to `<Silhouette>` when the file is absent so dev/staging works before assets land.
- **Analytics** — Vercel Web Analytics (cookieless) + 7 custom events at key funnel hook points.

**Why this shape**: the spec already names Vercel + Upstash KV; Next.js App Router is the lowest-friction fit (one deploy, one repo, edge OG out of the box, no separate API layer). Zustand keeps the spec's `RunState` + `GlobalState` shape ergonomic without reducer boilerplate. Lifting `styles.css` near-verbatim preserves design tokens and the `--split` intensity contract. The "drop assets in later" pattern (portraits + audio) decouples engineering from sourcing/legal review.

## Technical Details

### Tech stack
- **Next.js 15** (App Router, TypeScript, React 19)
- **Zustand** + `persist` middleware (split storage: session + local)
- **@vercel/kv** (Upstash-backed) for counters and unlock state
- **@upstash/ratelimit** for per-route rate limiting
- **@vercel/og** (edge runtime) for Phase 3 OG images
- **@vercel/analytics** for cookieless pageviews + custom events
- **Vitest** for unit tests, **Playwright** for e2e
- **next/font/google** for self-hosted Bungee / Oswald / VT323 / JetBrains Mono / Inter
- **No CSS framework** — `styles.css` ported (minus stripped shape variants); no Tailwind

### Data model (Upstash KV)
- `mk:<matchup>` → hash `{ old: <int>, new: <int> }` (e.g. `mk:raiden`)
- `mk:plays` → integer; drives unlock threshold
- `mk:unlocked` → `"1"` once `mk:plays >= REVEAL_AT` (sticky)
- `seen:<runId>` → `"1"` with 24h TTL — idempotency marker for `/api/complete`
- Rate-limit keys managed internally by `@upstash/ratelimit`

### Share code (Phase 3)
- 1 byte version (`0x01`) + 9 bits picks padded to 2 bytes → 3 bytes → base64url → ~4 chars
- Pure functions in `lib/share-code.ts`, round-trip tested
- Defied count NOT in the code — computed live from current `/api/results` crowd majorities

### State shape (Zustand, two persistence slices)

```ts
// sessionStorage slice — in-progress run, dies on tab close
type RunState = {
  phase: 'landing' | 'duel' | 'verdict' | 'share';
  step: number;                       // 0..8
  picks: ('old' | 'new')[];           // length === step (or 9 once complete)
  duelState: 'idle' | 'pickedOld' | 'pickedNew';
  order: number[];                    // shuffled fighter indices for this run
  runId: string;                      // uuid; idempotency key for /api/complete
};

// localStorage slice — settled identity, survives across sessions
type IdentityState = {
  muted: boolean;
  hasVoted: boolean;
  priorRun?: { picks, order, archetypeName, runId, completedAt };
  votedMatchups: Record<FighterId, 'old' | 'new'>;  // per-matchup dedupe
  seenUnlock: boolean;                // one-time unlock-moment gate
};

// Fetched, not persisted
type CrowdState = {
  scoreboardUnlocked: boolean;
  crowdStats: Record<FighterId, { old: number; new: number; total: number }>;
};
```

### Vote-submission contract
- Per pick: client calls `POST /api/vote { matchup, choice, runId }`. If `votedMatchups[matchup]` already set, skip the network call (already submitted from a previous session/tab on this browser). Server applies rate-limit + increments. Fire-and-forget; client doesn't await before advancing.
- On verdict reveal: client calls `POST /api/complete { runId }`. Idempotency: server checks `seen:<runId>`; if present, returns 204 no-op. Otherwise: increments `mk:plays`, checks `mk:plays >= REVEAL_AT` and flips `mk:unlocked` if needed, sets `seen:<runId>` with 24h TTL.

### Animations contract
- All keyframes in `styles.css` (`tracking`, `fc-track`, `barfill`, `glitch-x`, `reveal-up`, `pulse-red`) ported as-is.
- The bottom `@media (prefers-reduced-motion: reduce)` block in `styles.css` MUST be preserved — disables tracking sweeps and tilt transforms. `useTilt` also bails internally when `matchMedia('(prefers-reduced-motion: reduce)').matches`. Reduced motion also defaults audio off (soft hint).

## What Goes Where

- **Implementation Steps** (`[ ]` checkboxes): code, tests, config inside this repo.
- **Post-Completion** (no checkboxes): legal review of disclaimers, curated-portrait sourcing, audio sourcing, Upstash + Vercel project provisioning, domain registration (Phase 3 polish), v1.5 hardening (HMAC + votes-precede-completion).

## Implementation Steps

---

### Phase 0 — Bootstrap & design system

### Task 1: Scaffold Next.js app

**Files:**
- Create: `/Volumes/X9/Code/MK/package.json`
- Create: `/Volumes/X9/Code/MK/next.config.ts`
- Create: `/Volumes/X9/Code/MK/tsconfig.json`
- Create: `/Volumes/X9/Code/MK/app/layout.tsx`
- Create: `/Volumes/X9/Code/MK/app/page.tsx`
- Create: `/Volumes/X9/Code/MK/.gitignore`
- Create: `/Volumes/X9/Code/MK/.env.local.example`
- Create: `/Volumes/X9/Code/MK/public/robots.txt`

- [ ] run `npx create-next-app@latest . --typescript --app --no-tailwind --eslint --import-alias "@/*"` in `/Volumes/X9/Code/MK`
- [ ] add dependencies: `zustand`, `@vercel/kv`, `@upstash/ratelimit`, `@vercel/og`, `@vercel/analytics`
- [ ] add dev dependencies: `vitest`, `@vitejs/plugin-react`, `@testing-library/react`, `@testing-library/jest-dom`, `jsdom`, `@playwright/test`
- [ ] add scripts to `package.json`: `dev`, `build`, `start`, `test`, `e2e`
- [ ] set `<html data-btn-shape="banner" data-card-shape="tomb" lang="en">` in `app/layout.tsx`
- [ ] add basic `robots.txt`: `User-agent: *` / `Allow: /` / `Disallow: /r/`
- [ ] document env vars in `.env.local.example`: `KV_REST_API_URL`, `KV_REST_API_TOKEN`, `REVEAL_AT`
- [ ] verify `npm run dev` boots without errors (manual smoke)
- [ ] init git repo, first commit

### Task 2: Port styles.css and self-host fonts

**Files:**
- Create: `/Volumes/X9/Code/MK/app/globals.css`
- Modify: `/Volumes/X9/Code/MK/app/layout.tsx`

- [ ] copy `design_handoff_old_blood_new_blood/design-reference/styles.css` into `app/globals.css`
- [ ] strip alternate shape variants (`chamfer`, `slab`, `skew` button rules; `chamfer`, `slab` card rules) — keep only `banner` + `tomb`
- [ ] import `./globals.css` in `app/layout.tsx`
- [ ] configure self-hosted fonts in `app/layout.tsx` via `next/font/google` for Bungee, Oswald (400/600/700), VT323, JetBrains Mono (400/500), Inter (400/500/600/700); expose them as CSS variables matching `--f-disp-old`, `--f-disp-new`, `--f-mono-old`, `--f-mono-new`, `--f-body-new`
- [ ] confirm `prefers-reduced-motion: reduce` block at the bottom of the stylesheet is intact
- [ ] manual smoke: tokens render, animations run, no FOIT/FOUT regression

### Task 3: Fighters data + portrait manifest

**Files:**
- Create: `/Volumes/X9/Code/MK/lib/fighters.ts`
- Create: `/Volumes/X9/Code/MK/lib/portraits.ts`
- Create: `/Volumes/X9/Code/MK/public/portraits/.gitkeep`
- Create: `/Volumes/X9/Code/MK/lib/portraits.test.ts`

- [ ] copy the `FIGHTERS` array from `design-reference/src/system.jsx` into `lib/fighters.ts` as a typed const (`FighterId`, `Fighter`, `Era`)
- [ ] add `portraitFor(fighterId: FighterId, era: Era): string` returning `/portraits/<id>-<era>.jpg`
- [ ] write unit tests covering all 9 fighters × 2 eras (18 paths) and invalid input rejection
- [ ] run tests — must pass before next task

### Task 4: Silhouette + Portrait components

**Files:**
- Create: `/Volumes/X9/Code/MK/components/Silhouette.tsx`
- Create: `/Volumes/X9/Code/MK/components/Portrait.tsx`

- [ ] port `SILHOUETTES` (5 inline SVG masks: stance, guard, robe, cape, fourarm) and the `Silhouette` component from `system.jsx` into `components/Silhouette.tsx`
- [ ] create `components/Portrait.tsx` that renders `<img src={portraitFor(...)}>` and falls back to `<Silhouette>` via `onError`
- [ ] confirm the era-treatment overlay still composites correctly when `<img>` is the underlay (not `<image-slot>`)
- [ ] (visual component — smoke-only, no unit test; the `onError → Silhouette` fallback is exercised by the duel-run e2e in Task 19 since no portrait files ship yet)
- [ ] manual smoke: missing portrait → silhouette renders, present portrait → real image renders

### Task 5: BrandMark, DisclaimerRibbon, MuteToggle

**Files:**
- Create: `/Volumes/X9/Code/MK/components/BrandMark.tsx`
- Create: `/Volumes/X9/Code/MK/components/DisclaimerRibbon.tsx`
- Create: `/Volumes/X9/Code/MK/components/MuteToggle.tsx`

- [ ] port `BrandMark` (size, vertical) from `system.jsx`
- [ ] port `DisclaimerRibbon` — copy from handoff README "Legal positioning" section
- [ ] port `MuteToggle` — reads/writes `muted` from the Zustand identity slice (Task 9)
- [ ] manual smoke: all three render with correct typography and era styling

### Task 6: EraCard

**Files:**
- Create: `/Volumes/X9/Code/MK/components/EraCard.tsx`
- Create: `/Volumes/X9/Code/MK/components/EraCard.test.tsx`

- [ ] port `EraCard` from `system.jsx` with all four states (idle / idle-filled / picked / dimmed)
- [ ] replace `<image-slot>` usage with `<Portrait>`
- [ ] support `nameBandMode` ∈ `'full' | 'actor' | 'none'`
- [ ] support `picked` (stamp overlay) and `dimmed` props
- [ ] write unit tests asserting the right class names + stamp rendering across the 4 states
- [ ] run tests — must pass before next task

### Task 7: ProgressDots, VsSeam, OldNewBar

**Files:**
- Create: `/Volumes/X9/Code/MK/components/ProgressDots.tsx`
- Create: `/Volumes/X9/Code/MK/components/VsSeam.tsx`
- Create: `/Volumes/X9/Code/MK/components/OldNewBar.tsx`
- Create: `/Volumes/X9/Code/MK/components/OldNewBar.test.tsx`

- [ ] port `ProgressDots(total, current, picks)` from `system.jsx`
- [ ] port `VsSeam(vertical)` from `system.jsx`
- [ ] port `OldNewBar` from `cards.jsx`
- [ ] write unit tests covering OldNewBar percentage math at boundary cases (0/9, 9/9, 5/9)
- [ ] run tests — must pass before next task

### Task 8: useTilt hook

**Files:**
- Create: `/Volumes/X9/Code/MK/hooks/useTilt.ts`
- Create: `/Volumes/X9/Code/MK/hooks/useTilt.test.tsx`

- [ ] port `useTilt` from `system.jsx`: rAF-throttled, ±10deg max, bail on `matchMedia('(prefers-reduced-motion: reduce)').matches`
- [ ] return a ref + style object
- [ ] write unit tests: ref attaches, reduced-motion path returns identity transform (mock matchMedia)
- [ ] run tests — must pass before next task

---

### Phase 1 — State machine, screens, audio, analytics

### Task 9: Zustand store with split persistence

**Files:**
- Create: `/Volumes/X9/Code/MK/lib/store.ts`
- Create: `/Volumes/X9/Code/MK/lib/store.test.ts`

- [ ] define `RunState` (sessionStorage), `IdentityState` (localStorage), `CrowdState` (not persisted) per Technical Details
- [ ] actions: `start()`, `pick(era)`, `next()`, `advanceToShare()`, `setMuted(boolean)`, `setUnlocked(boolean)`, `setCrowdStats(stats)`, `recordCompletion(result)`, `markVoted(matchup, choice)` — `next()` is a **pure state transition** at this stage (no side effects); Task 25 will compose a side-effecting wrapper on top
- [ ] `start()` generates a fresh `runId` (uuid v4), a shuffled `order: number[]` (Fisher-Yates), resets `phase: 'duel'` + `step: 0` + `picks: []`
- [ ] `next()` advances `step` 0→8 or transitions `phase` to `'verdict'` at step 8; `advanceToShare()` transitions `phase: 'verdict' → 'share'`
- [ ] use Zustand `persist` middleware with two named stores: in-progress slice → `sessionStorage`, identity slice → `localStorage`
- [ ] write unit tests: state transitions (landing → duel → pick → next → ... → verdict → share), shuffle correctness (9 unique indices), idempotent rehydrate, voted-matchup dedupe
- [ ] run tests — must pass before next task

### Task 10: Archetype + run-result derivation

**Files:**
- Create: `/Volumes/X9/Code/MK/lib/archetype.ts`
- Create: `/Volumes/X9/Code/MK/lib/run-result.ts`
- Create: `/Volumes/X9/Code/MK/lib/archetype.test.ts`
- Create: `/Volumes/X9/Code/MK/lib/run-result.test.ts`

- [ ] copy `ARCHETYPE_SETS.A` and `archetypeFor(oldPicks)` from `cards.jsx` into `lib/archetype.ts`
- [ ] add `computeRunResult(picks, order, crowdStats)` in `lib/run-result.ts` returning `{ oldPicks, newPicks, picks: [{fighter, choice, majority}], defied, archetype, runId, date }`
- [ ] derive `majority` per fighter from `crowdStats` (`null` if `!unlocked`); `defied` accumulates only when majority is non-null
- [ ] write unit tests for `archetypeFor`: 0..9 → expected names
- [ ] write unit tests for `computeRunResult`: contrarian count with mocked majorities, `null` defied pre-unlock
- [ ] run tests — must pass before next task

### Task 11: LandingScreen

**Files:**
- Create: `/Volumes/X9/Code/MK/components/screens/Landing.tsx`

- [ ] port `LandingScreen` from `screens.jsx`
- [ ] vertical era split with the vertical `<BrandMark>` straddling the seam
- [ ] read `scoreboardUnlocked` + `playsUntil` from store; render countdown chip pre-unlock, scoreboard summary chip post-unlock
- [ ] FIGHT CTA → `store.start()` → phase transitions to `'duel'`
- [ ] manual smoke in browser

### Task 12: DuelScreen

**Files:**
- Create: `/Volumes/X9/Code/MK/components/screens/Duel.tsx`

- [ ] port `DuelScreen` from `screens.jsx`
- [ ] render `<ProgressDots>`, two stacked `<EraCard>`s with `<VsSeam>`, character name anchor
- [ ] three render states keyed off `duelState`: idle / picked-blind / picked-reveal
- [ ] when picked + `scoreboardUnlocked`, animate `<OldNewBar>` in below the cards
- [ ] handle `pick(era)` and Next CTA via store actions
- [ ] manual smoke in browser: full 9-card loop with mock crowd data

### Task 13: VerdictCard + VerdictRevealScreen

**Files:**
- Create: `/Volumes/X9/Code/MK/components/VerdictCard.tsx`
- Create: `/Volumes/X9/Code/MK/components/screens/Verdict.tsx`

- [ ] port `VerdictCardA` from `cards.jsx` (4:5 aspect, top archetype band, 9-cell pick grid with contrarian red ring, stats lockup, optional unlocked kicker)
- [ ] port `VerdictRevealScreen` from `screens.jsx`: dominant-era background, `reveal-up` entry animation
- [ ] apply `useTilt` to the verdict card on desktop hover (NOT to the duel cards)
- [ ] **remove the `RUN AGAIN` CTA** per Q2 — replace with `SHARE` (calls `store.advanceToShare()`) + `SEE SCOREBOARD` (`<Link href="/scoreboard">`)
- [ ] manual smoke: both `n1` and `unlocked` modes render correctly

### Task 14: ShareSheetScreen

**Files:**
- Create: `/Volumes/X9/Code/MK/components/screens/Share.tsx`

- [ ] port `ShareSheetScreen` from `screens.jsx`
- [ ] buttons: copy link (placeholder URL for Phase 1; real short URL in Phase 3), native share via `navigator.share` if available, download image (placeholder — wired in Task 28)
- [ ] **remove the `RUN AGAIN` CTA** per Q2
- [ ] manual smoke

### Task 15: ScoreboardScreen

**Files:**
- Create: `/Volumes/X9/Code/MK/components/screens/Scoreboard.tsx`
- Create: `/Volumes/X9/Code/MK/app/scoreboard/page.tsx`

- [ ] port `ScoreboardScreen` from `screens.jsx`
- [ ] locked variant: countdown + share-hook CTA
- [ ] unlocked variant: 9-row table (1995 actor / `<OldNewBar>` / 2026 actor / winner dot)
- [ ] route at `/scoreboard`
- [ ] manual smoke

### Task 16: UnlockMoment + ReturningVisitor screens

**Files:**
- Create: `/Volumes/X9/Code/MK/components/screens/UnlockMoment.tsx`
- Create: `/Volumes/X9/Code/MK/components/screens/ReturningVisitor.tsx`

- [ ] port `UnlockMomentScreen` from `screens.jsx`; gated by `seenUnlock` flag (one-time)
- [ ] port `ReturningVisitorScreen`: shown when `hasVoted === true`. Renders the user's `priorRun` verdict card (`unlocked` mode if board is now live), the 9 picks grid, defied count **re-derived against current crowdStats** (so it drifts), and a `SEE SCOREBOARD` CTA. **No replay CTA** per Q2.
- [ ] manual smoke

### Task 17: Wire the state machine in app/page.tsx

**Files:**
- Modify: `/Volumes/X9/Code/MK/app/page.tsx`

- [ ] make `app/page.tsx` a client component that reads `phase` + `hasVoted` + `seenUnlock` + `scoreboardUnlocked` from the store
- [ ] mount-time routing precedence: **`UnlockMoment` if `scoreboardUnlocked && hasVoted && !seenUnlock`** (returning user, board now live, hasn't yet seen the moment) → else **`ReturningVisitor` if `hasVoted`** → else **`Landing`** (first-time visitor, including those arriving on play #30+ who haven't voted)
- [ ] in-run phases (`duel` / `verdict` / `share`) are switched off `phase` and take precedence over the mount-time decision once a run has started
- [ ] add `<DisclaimerRibbon>` and `<MuteToggle>` as persistent overlays
- [ ] for Phase 1, populate `crowdStats` from a static mock in `lib/mock-crowd.ts`; `scoreboardUnlocked` toggled by `?unlocked=1` query param for testing both states
- [ ] manual smoke: landing → 9 duels → verdict → share → close tab → reopen → ReturningVisitor renders

### Task 17b: Wire analytics events

**Files:**
- Modify: `/Volumes/X9/Code/MK/app/layout.tsx`
- Create: `/Volumes/X9/Code/MK/lib/analytics.ts`
- Modify: relevant screen components

- [ ] add `<Analytics />` from `@vercel/analytics/react` in `app/layout.tsx`
- [ ] `lib/analytics.ts`: typed `track(event, props)` wrapper for the 7 custom events (pageviews are automatic via `<Analytics />`)
- [ ] wire `track()` calls at the 7 funnel hook points: `run_start` (FIGHT click), `pick` (each duel pick, with `fighter_id`, `era`, `step`), `run_complete` (verdict render, with `archetype`, `old_picks`), `share_open` (share screen mount), `share_click` (each share method, with `method`), `r_view` (`/r/[code]` mount — Phase 3, deferred), `unlock_moment_shown` (UnlockMoment mount)
- [ ] manual smoke: verify events fire in browser devtools network tab

### Task 18: Audio infrastructure (full API, files later)

**Files:**
- Create: `/Volumes/X9/Code/MK/lib/audio.ts`
- Create: `/Volumes/X9/Code/MK/lib/audio.test.ts`
- Create: `/Volumes/X9/Code/MK/public/audio/.gitkeep`
- Create: `/Volumes/X9/Code/MK/public/audio/README.md`
- Modify: `/Volumes/X9/Code/MK/components/screens/Duel.tsx`
- Modify: `/Volumes/X9/Code/MK/components/screens/Verdict.tsx`

- [ ] implement `audio.ts` with full A-scope API: lazy AudioContext, sample bank with all expected slots, `playOldImpact()` / `playNewImpact()` with variant rotation, `playOldVoice()`, `playNewVoice()`, `playVerdictSting()`, `setBgLoop(on)`
- [ ] **missing files are silent**: try/catch around fetch + decodeAudioData, dev console warning, no UI error
- [ ] unlock AudioContext on first user gesture (first tap on landing or duel)
- [ ] default muted; honor `muted` from store; honor `prefers-reduced-motion: reduce` as a soft hint to also default audio off
- [ ] wire taps in `Duel.tsx` to era impact + era voice; wire verdict reveal in `Verdict.tsx` to the sting
- [ ] **document expected slots** in `public/audio/README.md`: `impacts/old-{1,2,3}.webm` + `.mp3`, `impacts/new-{1,2,3}.webm` + `.mp3`, `voice/old.webm`, `voice/new.webm`, `sting/verdict.webm`, `bg/loop.webm`
- [ ] write unit tests for `audio.ts` (mock `fetch` + `AudioContext`): variant rotation cycles 1→2→3→1 across successive `playOldImpact()` calls; fetch-reject path is silent (no throw); `muted=true` short-circuits playback (no AudioContext interaction); reduced-motion default-off path; AudioContext unlock fires exactly once on first gesture
- [ ] manual smoke: tap → silent (expected, no files yet); MuteToggle visible and clickable; no errors in console
- [ ] run tests — must pass before next task

### Task 19: Phase 1 e2e smoke

**Files:**
- Create: `/Volumes/X9/Code/MK/e2e/duel-run.spec.ts`
- Create: `/Volumes/X9/Code/MK/playwright.config.ts`

- [ ] write a Playwright spec: load `/`, tap FIGHT, pick one card per duel (alternating old/new), reach verdict, assert the archetype text matches `archetypeFor()` for that picks pattern
- [ ] verify `npm run build` succeeds (catches SSR/client-boundary regressions)
- [ ] run e2e — must pass before Phase 2

---

### Phase 2 — Real backend (Upstash KV)

### Task 20: KV helpers + mock fallback

**Files:**
- Create: `/Volumes/X9/Code/MK/lib/kv.ts`
- Create: `/Volumes/X9/Code/MK/lib/kv.test.ts`
- Modify: `/Volumes/X9/Code/MK/.env.local.example`

- [ ] `getKv()` factory: returns real `@vercel/kv` client when `KV_REST_API_URL` is set, else returns an in-memory `Map`-backed mock with the same interface
- [ ] helpers: `incrementVote(matchup, choice)`, `getCounts()`, `getPlays()`, `incrementPlays()`, `isUnlocked()`, `flipUnlocked()`, `seenRun(runId): boolean`, `markRunSeen(runId)` (24h TTL)
- [ ] export `REVEAL_AT` from env (default `30`); for dev, `.env.local.example` ships `REVEAL_AT=5`
- [ ] write unit tests against the mock: increment math, unlock flip at threshold, idempotency marker TTL behavior
- [ ] run tests — must pass before next task

### Task 21: Rate-limit wrapper

**Files:**
- Create: `/Volumes/X9/Code/MK/lib/rate-limit.ts`
- Create: `/Volumes/X9/Code/MK/lib/rate-limit.test.ts`

- [ ] thin wrapper around `@upstash/ratelimit`: `rateLimitVote(ip)`, `rateLimitComplete(ip)` with the documented thresholds (120/IP/hr and 5/IP/hr respectively, sliding window)
- [ ] in mock-KV mode, return an in-memory limiter so local dev works without creds
- [ ] write unit tests: limit enforcement, reset after window
- [ ] run tests — must pass before next task

### Task 22: POST /api/vote

**Files:**
- Create: `/Volumes/X9/Code/MK/app/api/vote/route.ts`
- Create: `/Volumes/X9/Code/MK/app/api/vote/route.test.ts`

- [ ] handler accepts `{ matchup: FighterId, choice: 'old' | 'new', runId: string }`
- [ ] validate matchup ∈ `FIGHTERS`, choice ∈ `{old, new}`, runId is non-empty; reject with 400 otherwise
- [ ] enforce IP rate limit via `rateLimitVote`; respond 429 on limit. **By contract, 429 is silent client-side** (Q7/Q8) — Task 25's `submitVote()` swallows it without surfacing to UI. Do not add error messaging here.
- [ ] increment `mk:<matchup>` hash
- [ ] response: `{ ok: true, counts?: { old, new }, unlocked: boolean }` — counts omitted when `!unlocked`
- [ ] write unit tests with mocked KV: happy path, validation rejection, rate-limit rejection, pre-unlock counts omission
- [ ] run tests — must pass before next task

### Task 23: POST /api/complete

**Files:**
- Create: `/Volumes/X9/Code/MK/app/api/complete/route.ts`
- Create: `/Volumes/X9/Code/MK/app/api/complete/route.test.ts`

- [ ] handler accepts `{ runId: string }`
- [ ] enforce IP rate limit via `rateLimitComplete`; respond 429 on limit
- [ ] if `seenRun(runId)` → return 204 no-op (idempotent retry)
- [ ] else: `markRunSeen(runId)`, `incrementPlays()`, check if `mk:plays >= REVEAL_AT` → `flipUnlocked()`; respond `{ ok: true, unlocked: <new state>, justUnlocked: <bool> }`
- [ ] write unit tests: first call increments + flips at threshold, second call with same runId returns 204, rate-limit, validation
- [ ] run tests — must pass before next task

### Task 24: GET /api/results

**Files:**
- Create: `/Volumes/X9/Code/MK/app/api/results/route.ts`
- Create: `/Volumes/X9/Code/MK/app/api/results/route.test.ts`

- [ ] handler returns `{ unlocked: boolean, plays: number, threshold: number, stats?: Record<FighterId, {old, new, total}> }` — `stats` omitted when `!unlocked`
- [ ] cache-control `s-maxage=10, stale-while-revalidate=60` (edge cache)
- [ ] write unit tests with mocked KV: pre-unlock (no stats), post-unlock (stats present), shape correctness
- [ ] run tests — must pass before next task

### Task 25: Resilience client + frontend wire-up

**Files:**
- Create: `/Volumes/X9/Code/MK/lib/api-client.ts`
- Create: `/Volumes/X9/Code/MK/lib/api-client.test.ts`
- Modify: `/Volumes/X9/Code/MK/lib/store.ts`
- Modify: `/Volumes/X9/Code/MK/lib/store.test.ts`
- Modify: `/Volumes/X9/Code/MK/app/page.tsx`
- Delete: `/Volumes/X9/Code/MK/lib/mock-crowd.ts`

- [ ] `api-client.ts`: `submitVote(matchup, choice, runId)`, `submitComplete(runId)`, `fetchResults()` — typed, with the documented resilience policies (Q7)
  - `fetchResults()` failures → return synthesized `{ unlocked: false, plays: 0, threshold: 30, stats: {} }`
  - `submitVote()` failures → swallowed, no retry, no throw
  - `submitComplete()` failures → 3× exponential backoff (500ms / 2s / 5s), then resolve with `{ ok: false, local: true }`
- [ ] on mount, `app/page.tsx` calls `fetchResults()` → populates `crowdStats` + `scoreboardUnlocked` in store
- [ ] **modify `store.ts`**: keep `next()` pure (per Task 9); add a NEW side-effecting action `recordPickAndSubmit(era)` that (a) checks `votedMatchups[matchup]` — if present, skip the network call; else fire-and-forget `submitVote()` and `markVoted()` on resolve; (b) calls `next()`. Wire `DuelScreen.tsx` (Task 12) to call `recordPickAndSubmit()` instead of the prior `next()`-only flow.
- [ ] in store's verdict-mount effect (inside `Verdict.tsx`, Task 13): call `submitComplete(runId)`; on any resolve (success or local fallback), `recordCompletion()` writes `hasVoted: true` + `priorRun` to identity slice
- [ ] remove the mock crowd data and the `?unlocked=1` toggle
- [ ] **update `store.test.ts`** to cover the new `recordPickAndSubmit()` action: votedMatchups dedupe (skip network when flag set), `markVoted` write on submitVote resolve, `next()` still called regardless of network outcome
- [ ] write unit tests for the resilience client (`api-client.test.ts`): retry counts, fallback synthesis, `submitComplete` idempotency (same runId → server-side dedupe assumed; client just calls the endpoint)
- [ ] manual smoke against a local in-memory KV

### Task 26: Phase 2 e2e

**Files:**
- Create: `/Volumes/X9/Code/MK/e2e/backend.spec.ts`

- [ ] Playwright spec with route interception mocking `/api/results` + `/api/vote` + `/api/complete`
- [ ] verify pre-unlock branch (no crowd bars, n1 verdict), post-unlock branch (bars animate, unlocked verdict)
- [ ] verify resilience: when `/api/results` returns 500, the UI still renders in pre-unlock mode with no error UI
- [ ] verify idempotency: simulate page reload mid-run → resume from sessionStorage → completion sends the same runId
- [ ] run e2e — must pass before Phase 3

---

### Phase 3 — Virality layer (OG + share URLs)

### Task 27: Share-code encode/decode

**Files:**
- Create: `/Volumes/X9/Code/MK/lib/share-code.ts`
- Create: `/Volumes/X9/Code/MK/lib/share-code.test.ts`

- [ ] `encodeShareCode(picks: ('old'|'new')[9]): string` — version byte is internal to the encoder, not a caller parameter; output is base64url, ~4 chars
- [ ] `decodeShareCode(code: string): { version: number; picks: ('old'|'new')[9] }` — `version` surfaces on decode for future migration checks; throws on malformed input or unsupported version
- [ ] write round-trip unit tests across multiple pick patterns + edge cases (all old, all new, alternating)
- [ ] write tests for malformed input: empty string, wrong version byte, bad base64
- [ ] run tests — must pass before next task

### Task 28: /r/[code] result page

**Files:**
- Create: `/Volumes/X9/Code/MK/app/r/[code]/page.tsx`

- [ ] dynamic route renders the **friend's** verdict card by decoding `params.code`
- [ ] fetch current `/api/results` on server (or client) to compute live `defied` count if `unlocked`, else render `n1` mode
- [ ] **auto-upgrade behavior (per Q5)**: a code shared pre-unlock renders in `n1` mode while the board is still locked; the same code, fetched after the board unlocks, automatically renders in `unlocked` mode with a populated `defied` count. No client logic special-cases this — it falls out of "read live `/api/results` every render."
- [ ] reuse the same `VerdictCard` component, no compare layer per Q4
- [ ] single CTA: `PLAY YOURSELF` → links to `/` (which starts a fresh run for the visitor)
- [ ] `generateMetadata`: set `og:image`, `og:title` (archetype name), `og:description` (blurb), `twitter:card: summary_large_image`, all pointing at `/api/og?code=<code>`
- [ ] fire `r_view` analytics event on mount
- [ ] manual smoke: open `/r/<known-code>` and confirm the card matches the encoded picks

### Task 29: GET /api/og — per-result preview image

**Files:**
- Create: `/Volumes/X9/Code/MK/app/api/og/route.tsx`

- [ ] edge runtime; uses `@vercel/og` (`ImageResponse`)
- [ ] accepts `?code=<share-code>`; decodes via `lib/share-code.ts`
- [ ] fetch live crowd stats (server-side `fetch` to own `/api/results`) to compute `defied` for `unlocked` mode
- [ ] render the 1200×630 layout per handoff Section 8: left 56% identity slab (brandmark + archetype name in 56px `.nb-display.nb-condensed` + stats lockup), right 44% hero-pick diptych
- [ ] hero diptych shows the user's first contrarian pick (or first pick if `n1`); picked side fully lit, other dimmed; vertical seam split at the user's overall lean %; red contrarian-needle line on top
- [ ] inline OKLCH colors; subset Inter + Oswald via `next/font` or fetched font binaries at edge
- [ ] cache-control `public, max-age=3600, s-maxage=86400`
- [ ] manual smoke: open `/api/og?code=<known-code>` in browser, confirm a 1200×630 PNG renders

### Task 30: Share sheet hookup

**Files:**
- Modify: `/Volumes/X9/Code/MK/components/screens/Share.tsx`
- Create: `/Volumes/X9/Code/MK/e2e/share-link.spec.ts`

- [ ] generate share URL from current run: `new URL('/r/' + encodeShareCode(picks), location.origin)`
- [ ] Copy Link → `navigator.clipboard.writeText(shareUrl)`, toast confirmation; fire `share_click` with `method: 'copy'`
- [ ] Native Share → `navigator.share({ url, title, text })` (feature-detect); fire `share_click` with `method: 'native'`
- [ ] Download Image → fetch `/api/og?code=<code>` and trigger download (reuses the server-rendered asset; no html2canvas needed); fire `share_click` with `method: 'download'`
- [ ] platform-specific buttons (X, Instagram, TikTok): construct intent URLs where supported, else fall back to copy
- [ ] e2e spec: `share-link.spec.ts` — load `/r/<encoded-code>`, assert verdict card renders, assert `/api/og?code=...` returns 200 + `image/png`
- [ ] manual smoke: paste resulting URL into a Twitter/X compose box, confirm unfurl shows the right card

### Task 31: Verify acceptance criteria

- [ ] verify all spec sections 1–14 are implemented or explicitly deferred; section 15 ("open items / next steps") items are tracked in Post-Completion
- [ ] verify edge cases:
  - Reduced-motion users (no tilt, no tracking sweep, audio default off)
  - Pre-unlock users (no crowd data leaked via /api)
  - Returning visitors (priorRun renders with live defied count)
  - Unlock moment (one-time, gated by `seenUnlock`)
  - Resilience (frontend functions when backend is down)
  - Idempotency (refresh-resume runs don't double-complete)
  - **Share-code auto-upgrade**: a `/r/[code]` link generated before unlock renders in `unlocked` mode (with `defied`) once the board flips — no client special-case needed (per Task 28)
- [ ] run full unit test suite: `npm run test`
- [ ] run e2e suite: `npm run e2e`
- [ ] run `npm run build`; bundle-size sanity check (warn if first-load JS > 200KB)
- [ ] Lighthouse pass on `/` and `/r/<code>`: target a11y ≥ 95, performance ≥ 85 on mobile

### Task 32: Finalize docs

**Files:**
- Modify: `/Volumes/X9/Code/MK/README.md`
- Create: `/Volumes/X9/Code/MK/CLAUDE.md`

- [ ] write top-level `README.md`: project pitch, setup, env vars, deploy steps, how to drop in portraits + audio
- [ ] write `CLAUDE.md` capturing patterns discovered: era-skin invariants, `--split` contract, `prefers-reduced-motion` contract, KV key naming, share-code versioning, "drop assets in later" pattern
- [ ] move this plan to `docs/plans/completed/`

## Post-Completion

*Items requiring manual intervention or external systems — no checkboxes, informational only.*

**Asset sourcing (drop-in pattern; non-blocking for deploy):**
- 18 character portraits (9 old + 9 new) → `public/portraits/<id>-<era>.jpg`. Until then, `<Silhouette>` fallback renders.
- Audio assets per the documented manifest → `public/audio/`. Until then, all audio playback is silent. Confirm royalty-free or original sourcing.

**Legal review (blocking for production launch):**
- Disclaimer ribbon copy
- "Unofficial fan project" framing across all copy (landing, OG cards, share text)
- Confirm no monetization (no ads, no data-sale analytics — Vercel Web Analytics is fine, it's cookieless first-party)
- Curated portrait licensing — clearance for whatever stills are sourced

**Infrastructure provisioning:**
- Create two Upstash KV databases (`mk-dev`, `mk-prod`)
- Wire `mk-prod` creds into the Vercel project's Production environment variables; leave `mk-dev` creds in Preview + Development env vars
- Set `REVEAL_AT=5` in dev/preview, `REVEAL_AT=30` (or tuned-from-staging) in prod
- Confirm Vercel edge functions are enabled for `/api/og`
- Confirm Vercel Web Analytics is enabled on the project

**Domain (Phase 3 polish):**
- Ship Phases 1–2 on `<your-handle>.vercel.app`
- Before Phase 3 share URLs go public, register a real domain (`oldbloodnewblood.com` or `obnb.app/.gg`) — easier to remember than the auto-generated Vercel URL

**v1.5 hardening (post-launch, non-blocking):**
- HMAC signature on `/api/complete` (client signs `runId + picks` with a session token issued by `/api/results`)
- Server check: reject `/api/complete` if `votes:<runId>` set doesn't contain 9 entries
- These mitigate determined-attacker scoreboard skewing; trivial fan-poll abuse is already blocked by rate limits + per-matchup localStorage flags

**Author credit (deferred):**
- Anonymous launch per Q12E. If/when ready, add a small `aleksei.dev` link to the right margin of `<DisclaimerRibbon>`.

**Localization (deferred):**
- English only at v1. Archetype blurbs are idiomatic — translating well takes real effort. Add when there's a clear locale demand.

**Staging dry-run (recommended before Phase 2 ships):**
- Deploy Phase 2 to a preview URL with `mk-dev` KV; manually drive `REVEAL_AT=5` plays to validate the unlock-moment screen fires correctly for a returning user
