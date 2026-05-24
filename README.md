# OLD BLOOD // NEW BLOOD

An unofficial Mortal Kombat fan poll — vote on the 1995 vs 2026 cast, get a verdict card, share it.

**Unofficial fan project. No ads, no monetization, no affiliation with NetherRealm Studios or Warner Bros.** All trademarks belong to their respective owners.

---

## What it is

Players play 9 head-to-head "which is better?" duels between the 1995 Mortal Kombat cast and the 2026 reboot cast, then receive a shareable verdict card. Tap a card to lock in a pick; tap the other card before NEXT to swap. Aggregate crowd stats unlock once enough sessions have completed (`REVEAL_AT` plays).

## Setup

```bash
npm install
npm run dev
```

The app runs at `http://localhost:3000`. Without Upstash env vars set, `lib/kv.ts` falls back to an in-memory mock KV — perfect for local development. No external services required to run locally.

## Environment variables

See `.env.local.example`. All are optional for local dev:

| Variable | Purpose |
|---|---|
| `KV_REST_API_URL` | Upstash KV REST endpoint. Omit locally for mock KV. |
| `KV_REST_API_TOKEN` | Upstash KV REST token. Omit locally for mock KV. |
| `REVEAL_AT` | Plays required before the scoreboard unlocks. `5` for dev/preview, `30` for production. |

## Scripts

| Script | Purpose |
|---|---|
| `npm run dev` | Next.js dev server (Turbopack). |
| `npm run build` | Production build. |
| `npm run start` | Serve the production build. |
| `npm run test` | Vitest unit tests. |
| `npm run e2e` | Playwright smoke tests. |
| `npm run e2e:install` | One-time install of the Playwright Chromium browser. Run once after cloning. |
| `npm run lint` | ESLint. |

## Responsive layout

Mobile-first design with a single layout-flip breakpoint at `min-width: 900px`:

- **<900px (mobile / tablet portrait)**: Duel renders two `EraCard`s side-by-side, divided only by the era-split background (no central seam). Long-form screens stack vertically.
- **>=900px (desktop / tablet landscape)**: Duel cards keep the side-by-side shape but gain a vertical `VS` seam between them and cap each slot at 400px wide. Long-form screens (Verdict, Share, UnlockMoment, ReturningVisitor, `/r/[code]`) use a centered reading column capped via the `.content-column` helper. Typography and spacing scale via `clamp()` so everything tunes itself between the two breakpoints.

Era invariants (the visual split between `[data-era="old"]` and `[data-era="new"]`) apply at every viewport — the desktop layer never harmonizes them. `MuteToggle` is `position: fixed` and anchors to the viewport corner at all sizes; `DisclaimerRibbon` renders inline at the bottom of the page in normal flow (full-width since Task 1 lifted the page-frame cap) — it's not viewport-pinned.

## Architecture

- **Next.js 16 App Router** — server + client components, edge runtime for `/api/og`.
- **Zustand** — run state (in-progress slice in `sessionStorage`, settled slice in `localStorage`).
- **Upstash KV** — vote counters, play counts, rate limits. In-memory fallback when creds absent.
- **`@vercel/og`** — per-result Open Graph preview cards rendered at the edge.

### Routes

| Route | Purpose |
|---|---|
| `/` | Landing → 9 duels → verdict → share state machine. |
| `/scoreboard` | Aggregate crowd stats (locked countdown pre-unlock, 9-row table post-unlock). |
| `/r/[code]` | A friend's verdict (share-link landing). Auto-upgrades from n1 to unlocked once the board flips. |
| `POST /api/vote` | Per-pick vote counter increment. Rate-limited 120/IP/hour. |
| `POST /api/complete` | Marks a run complete (idempotent on `runId`). Rate-limited 5/IP/hour. |
| `GET /api/results` | Returns `{ unlocked, plays, threshold, stats? }`. Stats omitted pre-unlock. |
| `GET /api/og` | Per-result 1200×630 Open Graph PNG. Edge runtime. |

## Drop-in assets

The app ships with silent silhouette fallbacks. Drop production assets in as they arrive — no code changes needed.

- **Portraits**: `public/portraits/<id>-<era>.jpg` (e.g. `public/portraits/scorpion-old.jpg`). Missing files render `<Silhouette>` SVG fallback.
- **Audio**: `public/audio/` per the slot manifest (era impacts, era voices, sting, bg loop). Missing files play silently — no console errors, no UI failures.

## Deploy

1. Connect the repo to Vercel.
2. Create two Upstash KV databases (`mk-dev`, `mk-prod`).
3. Set env vars per Vercel environment:
   - **Preview + Development**: `mk-dev` `KV_REST_API_URL` / `KV_REST_API_TOKEN`, `REVEAL_AT=5`.
   - **Production**: `mk-prod` `KV_REST_API_URL` / `KV_REST_API_TOKEN`, `REVEAL_AT=30`.
4. Enable Vercel Web Analytics on the project (cookieless, first-party).
5. Deploy. Edge runtime is enabled automatically for `/api/og`.

## Legal / disclaimer

- The persistent disclaimer ribbon ("Unofficial fan project") must remain visible across all screens.
- No trademarked marks (logos, dragon, etc.) in any owned asset.
- No ads, no monetization, no data-sale analytics. Vercel Web Analytics (cookieless first-party) is the only telemetry.
- Curated portrait licensing must be cleared before any production stills are dropped in.

See `OLD_BLOOD_NEW_BLOOD_spec.md` for the full product spec and `design_handoff_old_blood_new_blood/` for the design system source.
