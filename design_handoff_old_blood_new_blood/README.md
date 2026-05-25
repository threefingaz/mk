# Handoff: OLD BLOOD // NEW BLOOD

A fan-poll web app that pits the cast of a 1995 cult-classic action film against its 2026 reboot — 9 head-to-head character duels, then a verdict card that classifies the player and primes them to share. Designed as an unofficial fan project with explicit "not affiliated" disclaimers throughout.

---

## About the design files

The files in `design-reference/` are **design references created in HTML** — interactive prototypes that show the intended look, feel, and behavior. They are **not production code**. The HTML uses Babel-in-the-browser for JSX, a custom `<image-slot>` web component for drag-and-drop portraits, and a "design canvas" wrapper that lays every screen and state out on a single pan-and-zoom page for review.

Your job is to **recreate these designs in the target codebase's environment** — most likely a Next.js / Vite + React app, since the prototype is already React-shaped — using its established patterns (state management, routing, image handling, analytics). If no environment exists yet, choose the most appropriate framework for the project and implement the designs there. Lift the visual tokens and component composition wholesale; rebuild the data plumbing (vote persistence, crowd-stats aggregation, share-URL generation, OG rendering) against real infrastructure.

## Fidelity

**High-fidelity.** Colors, typography, spacing, animations, and interaction states are final. The CSS in `design-reference/styles.css` is the design system — the OKLCH color tokens, the two `era-old` / `era-new` background recipes, the era-treatment overlay stack, the shape variants — all of it should be ported as-is (or as-close-as-your-stack-allows). Where the prototype renders the same component twice (once "n=1", once "unlocked"), both states ship.

## Legal positioning (read first)

The brief defines this as an unofficial fan project. The prototype follows that brief:

- **No trademarked logos, lettering, or franchise marks** appear anywhere. The "OLD BLOOD // NEW BLOOD" wordmark is original.
- Character names and actor names are used **descriptively** (the same way a Wikipedia page or a fan-poll site would reference them). They are not styled to imitate official key art.
- A persistent disclaimer ribbon — `UNOFFICIAL FAN PROJECT · NOT AFFILIATED WITH WARNER BROS., NEW LINE OR NETHERREALM · NO ADS, NO MONETIZATION` — sits at the bottom of every screen.
- Portraits are **user-supplied** via the `<image-slot>` drag-and-drop component. The shipping product should either (a) keep that pattern (users drop their own reference images, stored client-side only), or (b) source officially licensed/CC press stills. **Do not bake studio publicity photos into the build.**

Before launch, have legal review the disclaimer language, the absence of monetization, and the user-supplied-image model.

---

## Visual system

### Two skins, one skeleton

Every screen is built from a **shared structural skeleton** wearing one of two **era skins**:

| Skin                            | Era  | Mood                                                       | Key vocabulary                                                                                                                                                       |
| ------------------------------- | ---- | ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `.era-old` / `[data-era="old"]` | 1995 | Cult-classic Hong Kong action poster — painted, theatrical | Crimson, antique gold, jade, cobalt, bone cream; halftone print dots; subtle scanlines; chromatic-aberration text shadows; VHS-tracking sweep; tape-on-glass texture |
| `.era-new` / `[data-era="new"]` | 2026 | Stormy blockbuster — choral-gothic, cinematic              | Slate blue, lightning white, ash gray, blood red; sparse 64px crosshair grid; tight vignette + top-left lightning rim; blood-red bottom wash                         |

The two skins are **never harmonized** — that contrast is the entire brand. Where they meet (a duel screen, a diptych share card, the landing page), they butt directly against each other with a hard 1px seam or a "VS" plate.

### Color tokens (OKLCH)

All colors are defined in `:root` of `styles.css`. The full list:

**Old Blood (1995)**

```
--ob-ink:      oklch(0.14 0.02 30)     /* deep crimson-black */
--ob-ink-2:    oklch(0.20 0.03 30)
--ob-bone:     oklch(0.94 0.04 85)     /* cream paper */
--ob-bone-2:   oklch(0.86 0.05 80)
--ob-blood:    oklch(0.52 0.22 25)     /* signature red */
--ob-blood-2:  oklch(0.40 0.20 25)
--ob-gold:     oklch(0.78 0.16 85)     /* antique gold */
--ob-gold-2:   oklch(0.62 0.14 80)
--ob-jade:     oklch(0.55 0.14 165)
--ob-cobalt:   oklch(0.45 0.18 250)
--ob-cyan:     oklch(0.78 0.14 200)
--ob-magenta:  var(--ob-gold)          /* legacy alias */
```

**New Blood (2026)**

```
--nb-ink:       oklch(0.08 0.015 250)  /* storm-night blue */
--nb-ink-2:     oklch(0.14 0.025 245)
--nb-line:      oklch(0.28 0.025 245)
--nb-bone:      oklch(0.96 0.005 270)  /* lightning white */
--nb-mute:      oklch(0.58 0.02 245)
--nb-steel:     oklch(0.40 0.04 245)
--nb-storm:     oklch(0.22 0.05 245)
--nb-lightning: oklch(0.96 0.02 240)
--nb-red:       oklch(0.55 0.24 27)    /* signature red */
--nb-red-2:     oklch(0.40 0.22 27)
--nb-blood:     oklch(0.32 0.18 25)
```

The two reds (`--ob-blood` and `--nb-red`) are intentionally adjacent in hue but different in chroma/lightness — they read as "the same blood, painted differently." Don't unify them.

### Typography

Five fonts, all from Google Fonts. Use the same `<link>` block as the prototype.

| Token          | Family                                              | Use                                                            |
| -------------- | --------------------------------------------------- | -------------------------------------------------------------- |
| `--f-disp-old` | **Bungee** (fallback: Arial Black)                  | Old-era display — chunky, marquee, all-caps                    |
| `--f-disp-new` | **Oswald** (400/600/700, fallback: Arial Narrow)    | New-era display — tall, condensed, blockbuster                 |
| `--f-mono-old` | **VT323** (fallback: Courier New)                   | Old-era mono — pixel-CRT, used for tag codes like `RAID.MMXCV` |
| `--f-mono-new` | **JetBrains Mono** (400/500, fallback: Courier New) | New-era mono — clean, used for HUD labels and disclaimers      |
| `--f-body-new` | **Inter** (400/500/600/700, system-ui fallback)     | Body copy across both skins                                    |

Display type rules:

- **Old display** (`.ob-display`) is set ALL CAPS with `letter-spacing: 0.02em`. Pair with `.ob-chromatic` to add the signature ±2px red/cyan text-shadow split. Pair with `.ob-beveled` for the 4-step extruded movie-poster lettering.
- **New display** (`.nb-display`) is ALL CAPS, near-zero letter-spacing, weight 700. Add `.nb-condensed` (`font-stretch: condensed`) for headlines.

### Shape language

Two CSS-driven variant systems control "how angular is this product":

**Button shape** — `[data-btn-shape]` on `<html>`, four values:

- `banner` _(recommended, default)_ — tapered hex tab, forged-plaque feel
- `chamfer` — diagonal corner cuts
- `slab` — pure rectangle with inner stroke, brutalist HUD
- `skew` — kinetic parallelogram

**Card shape** — `[data-card-shape]` on `<html>`, three values:

- `tomb` _(recommended)_ — arched top, flat bottom, thin inner frame, corner pip
- `chamfer` — soft chamfered corners (default radius tokens)
- `slab` — zero radius, brutalist rectangle

Ship the recommended pair (`banner` + `tomb`) for the v1 launch. The other variants can be removed from production CSS if you're not exposing them.

### Split intensity

The CSS custom property `--split` (range 0.5 / 1.0 / 1.6) scales the intensity of every era-treatment effect — scanline opacity, chromatic-aberration offset, grid visibility, tracking-sweep speed. The Tweaks panel exposes it as `subtle | balanced | aggressive`. Ship at **1.0 (balanced)** unless analytics show users on low-end devices need `subtle` for FPS.

---

## Components (production manifest)

The system has roughly a dozen primitives. Sources are in `design-reference/src/system.jsx` and `design-reference/styles.css`.

### `<BrandMark size vertical />`

The "OLD BLOOD // NEW BLOOD" wordmark. Three pieces (`bm-old` cream tile, `bm-slash` gold slash, `bm-new` ink-blue tile) butted together with hard seams. `vertical=true` stacks them for tall layouts. Renders at any size; `size` prop sets `font-size`.

### `<EraCard fighter era picked onPick slotIdPrefix nameBandMode />`

**The workhorse component — the fighter trading card.** 9 instances per run, plus reveal/share usage.

Structure:

```
┌─────────────────────────────┐
│ [top band]  RAID.MMXCV · 1995│  ← era-tagged tag strip
├─────────────────────────────┤
│                              │
│   [portrait — image-slot]    │  ← 4:5 aspect, era overlay layer on top
│                              │
├─────────────────────────────┤
│ RAIDEN                       │  ← name band (era-styled)
│ ▪ Christopher Lambert        │
└─────────────────────────────┘
```

Props:

- `fighter` — object from `FIGHTERS` array (id, name, oldActor, newActor, oldTag, newTag, silhouette)
- `era` — `'old' | 'new'`
- `picked` — bool; when true, shows the picked-state stamp overlay
- `onPick` — click handler (omitting it makes the card non-interactive)
- `slotIdPrefix` — string; namespaces the `<image-slot>` id so the same fighter can appear in multiple contexts with independent images
- `nameBandMode` — `'full'` (character + actor), `'actor'` (actor only, for duel screens where the character name is in the screen anchor), `'none'`

States (see `02 · Fighter card states` section of the canvas): **idle (empty slot)**, **idle filled** (portrait dropped), **picked** (stamp overlay, magenta/red flood), **dimmed** (the un-chosen card after the user picks the other side — `opacity: 0.32; filter: grayscale(0.9) brightness(0.7)`).

### `<ProgressDots total current picks />`

Thin segmented bar at the top of every duel screen. Each segment is 2px tall (4px for the active one), filled with `--ob-magenta` for past old-picks and `--nb-red` for past new-picks. Past unfilled = `rgba(255,255,255,0.5)`, future = `rgba(255,255,255,0.18)`.

### `<MuteToggle muted onToggle />`

Bottom-right affordance. Sound is **off by default**; the toggle's job is to advertise that there _is_ audio. Label reads `SOUND OFF · TAP TO ENABLE` when muted, `SOUND ON` (with a pulsing red dot) when on.

### `<DisclaimerRibbon />`

Persistent 8px-padded bar at the bottom of `<PhoneFrame>`. Mono font, 10px, letter-spacing 0.08em, 40% white. Copy is fixed (see Legal section above).

### `<VsSeam vertical />`

The "VS" plate between two era columns. Renders the word in `.nb-display.nb-condensed` at 28px in `--nb-red` with an 18px red glow, optionally flanked by a gradient line on both sides.

### `<Silhouette kind era />`

The fallback artwork rendered behind empty image slots — an abstract fighter shape (stance / guard / robe / cape / fourarm) masked from solid black and painted with the era's treatment (chromatic offset for old, gradient fill for new). Recognizably "a fighter," not a specific person. SVG masks are inlined in `system.jsx`.

### `<image-slot>` (web component)

The drag-and-drop portrait container. Source in `design-reference/image-slot.js`. Persists dropped images to `localStorage` by `id`. The shipping product should swap this for whatever image-source mechanism the team decides on (user upload + CDN, or curated CC stills). Keep the **same outer rectangle and the same overlay-on-top composition** so the era treatment continues to look right over real photography.

### Buttons — `.btn-old` and `.btn-new`

- `.btn-old` — cream tile, ink border, hard 4px gold-shadow drop on the bottom-right. Hover shifts it 2px up-left; active hammers it 2px down-right.
- `.btn-new` — chamfered tile (clipped corners), bone-on-ink. Add `.btn-new-red` for the destructive/primary "FIGHT" CTA.

Hit target: minimum 44×44. Padding in the prototype is 14×22 which clears that easily.

---

## Screens

Eight player-facing screens, all 390×780 mobile-first (the prototype labels them `390` wide). One desktop layout at 1440×900. One server-rendered 1200×630 OG card.

### 1. Landing

Cold open — communicate the split, the premise, and a single entry point. The screen is divided **vertically down the middle**: left half is `.era-old`, right half is `.era-new`. The vertical `<BrandMark>` straddles the seam.

Two data states:

- **Pre-unlock** — shows a `PLAYS UNTIL SCOREBOARD UNLOCKS · 12` countdown chip
- **Post-unlock** — chip replaced by the live scoreboard summary

CTA: a single large `.btn-new.btn-new-red` reading `FIGHT` (or equivalent). Below it, fine print: `9 ROUNDS · ~90 SECONDS`.

### 2. Duel run (the workhorse — 9 of these per session)

The same skeleton shown 9 times in a row. Vertical split: top half is the OLD card, bottom is the NEW card, with a horizontal `<VsSeam>` between. Above the cards: `<ProgressDots>` showing `03 / 09`. The character's anchor — name + the words `1995` and `2026` — sits in tiny mono lockups above each card.

Three states per duel:

- **idle** — both cards live, tappable. Cards animate in with the era-treatment overlays running.
- **after pick · blind** (pre-unlock) — chosen card gets the `picked` stamp, opposite card dims to 32% opacity + grayscale. CTA flips from `TAP TO PICK` to `NEXT FIGHTER ›`.
- **after pick · crowd bar reveal** (post-unlock) — same as blind, plus a horizontal **`<OldNewBar>`** under the cards showing crowd split (`71% OLD · 29% NEW`). The bar fills with a `barfill` keyframe animation from 0 to its final width over ~600ms.

**Desktop variant** (1440×900): same vocabulary, more breathing room — side-by-side cards instead of stacked, theatrical center VS plate at scale.

### 3. Scoreboard

Hidden until ~25–30 plays have been recorded in the system. Before that, the route renders a locked screen with a countdown that doubles as a share hook (`SHARE TO HELP UNLOCK · 12 PLAYS LEFT`).

Unlocked view: a 9-row table, one row per fighter, each row showing:

- 1995 actor name (`.ob-mono`, cream)
- crowd `<OldNewBar>` for that matchup
- 2026 actor name (`.nb-mono`, mute)
- "winner" indicator (red dot on the winning side)

### 4. Verdict reveal

End-of-run beat. The verdict card flies in with a `reveal-up` keyframe (translateY 20px + opacity 0 → 0, dwell, then tilt-on-hover via `useTilt`). Background is the user's dominant era — if they picked OLD ≥5 times, the screen wears `.era-old`; otherwise `.era-new`.

### 5. Verdict card

The growth engine — this is what gets screenshotted and shared. **Direction A (Trading Card) is locked.**

**Direction A — Trading Card:**

- 4:5 aspect
- Top band: the user's archetype name in `.ob-display` (with chromatic shadow) over the user's dominant era's background
- Middle: a 9-cell grid showing their picks — one mini-card per fighter, era-styled per pick. The "contrarian" picks (where their choice ≠ crowd majority) get a red ring.
- Bottom: stats lockup — `oldPicks / 9 OLD · newPicks / 9 NEW · defied/9 CONTRARIAN` (the contrarian count only renders in `data="unlocked"` mode)
- Optional kicker line (`data="unlocked"`): one-liner like `"YOU DEFIED THE CROWD 3 TIMES"`

Five **archetype outcomes** keyed to the player's old-vs-new pick count (definitions in `design-reference/src/cards.jsx` — the `ARCHETYPE_SETS.A.items` array):

| Range (OLD picks) | Name          | Lean  |
| ----------------- | ------------- | ----- |
| 8–9               | 90s Die-Hard  | old   |
| 6–7               | Old-School    | old   |
| 4–5               | Switch-Hitter | split |
| 2–3               | New-School    | new   |
| 0–1               | New Blood     | new   |

Copy will be tuned during development — the names and blurbs are stable v1 text but the team should expect to iterate on tone (punchier verbs, shorter blurbs, locale variants) in dev.

Two data states for every archetype:

- `n1` — no crowd data yet (only the user's picks summarize)
- `unlocked` — full crowd context including contrarian count

### 6. Share sheet

Renders immediately after the verdict reveal. Shows the verdict card centered, with share buttons below: copy link, native share, download image, plus 2–3 platform-specific (Twitter/X, Instagram, TikTok). All buttons follow `.btn-new` style.

### 7. Phase-2 moments

- **Unlock moment** — the one-time event when the live scoreboard first goes live. Full-bleed `.era-new` background, big `.nb-display` headline `"THE BOARD IS LIVE"`, subhead `"30 PLAYS LOGGED · CROWD VERDICTS NOW VISIBLE"`. Confetti-style red-and-cream particle burst. Single CTA: `SEE THE BOARD`.
- **Returning visitor** — what someone sees on revisit once a per-browser flag confirms they've voted. Their verdict card pre-loaded, plus a "since you voted" stats row and a CTA to share or browse the scoreboard.

### 8. Open Graph card (Phase 3)

Server-rendered, 1200×630 (the canvas uses 600×315 — the same 2:1 ratio). Layout:

- **Left 56%** — identity slab on `.era-new` with the brandmark, the user's archetype name in 56px `.nb-display.nb-condensed`, the blurb, and the stats lockup
- **Right 44%** — visual signature: a **hero-pick diptych**. The single character the user picked AGAINST the crowd majority (their "hot take"), shown as side-by-side OLD/NEW portraits with the picked side fully lit and the other dimmed. The vertical seam between halves is split at the user's overall lean percentage; a red contrarian-needle line sits on top.

In `n1` mode (no crowd data yet), the hero falls back to the user's first OLD pick (or first NEW pick if their lean is new).

---

## Tokens recap

### Spacing

The system doesn't use a numeric scale — it uses **structural spacing** keyed to each component. Common values that appear:

- Card outer padding: `10px`
- Card top/bottom band padding: `6–8px` cross, `8–10px` along axis
- Screen padding: `24–32px`
- Section gap (between stacked cards on duel screen): `8–14px`
- Disclaimer ribbon padding: `8px 12px`

When porting, codify these into a small token set (e.g. `--sp-1: 4px` → `--sp-6: 32px`) rather than literal pixel values everywhere.

### Border radius

- `--card-r: 6px` (general)
- `--card-r-old: 4px` (old cards — tighter, stamped feel)
- `--card-r-new: 2px` (new cards — almost rectangular, brutalist)
- `tomb` shape overrides this to `14px 14px 3px 3px` (arched top, flat bottom) — this is the recommended v1 shape

### Shadows

- Old card resting: `2px 2px 0 var(--ob-ink)` — hard offset, no blur
- Old card picked: `3px 3px 0 var(--ob-ink), 6px 6px 0 var(--ob-magenta)` — double-stack
- New card resting: `0 10px 36px -8px oklch(0.40 0.22 27 / 0.35), 0 4px 14px -4px rgba(0,0,0,0.6)` — soft red bloom + hard underline
- New card picked: `0 14px 36px -8px oklch(0.55 0.24 27 / 0.7), 0 0 0 1px var(--nb-red)`
- Button hovers shift offset by ±2px on both axes (old = drops further, new = stays put)

### Animations

- `tracking` — 9s linear infinite, drives the old-era tape-tracking sweep (scaled by `--split`)
- `fc-track` — 7s linear infinite, the per-card scanline sweep
- `barfill` — `width: 0 → final`, one-shot, used on `<OldNewBar>` reveal
- `glitch-x` — 5s loop, infrequent 2–3px x-axis jitter
- `reveal-up` — one-shot, used for verdict card entry
- `pulse-red` — 1.6s infinite, used on the mute toggle's "sound on" dot
- All animations honor `prefers-reduced-motion: reduce` — animated tracking, tape sweeps, and tilt transforms are disabled inside that media query (see bottom of `styles.css`). **Preserve this contract.**

---

## Interactions & behavior

### Run state machine

```
landing → duel(step 0) → duel(step 1) → ... → duel(step 8) → verdict → share
                                                                  │
                                                                  └→ landing (replay)
```

- Tapping a card on `duel(step N)` records the pick, transitions the screen to the after-pick state, and reveals a `NEXT FIGHTER ›` CTA. The crowd bar (if `scoreboardUnlocked`) animates in on the same frame as the picked stamp.
- `NEXT FIGHTER ›` advances to `duel(step N+1)` or, if N === 8, to `verdict`.
- Verdict reveals with a 600ms `reveal-up` entry. Hover (desktop only) engages tilt via `useTilt` — disabled with reduced motion. Tap proceeds to `share`.
- Share sheet has multiple exits; each is its own outbound event.

### Vote persistence

- Per-browser flag (localStorage or first-party cookie) that records: `runId`, the 9 picks, the resulting archetype, and a `hasVoted: true` flag.
- The returning-visitor screen reads this flag and renders the user's prior verdict card.
- Crowd stats are server-aggregated. The "n=1 vs unlocked" mode flip is driven by **total votes recorded** crossing some threshold (the prototype uses 30 for the demo; tune for launch).

### Crowd-stats unlock

- Pre-unlock: scoreboard route renders the countdown variant; verdict cards render in `n1` mode; duel screens skip the crowd-bar reveal.
- Server flips a single `scoreboardUnlocked: true` flag when the threshold is met. Clients re-fetch on next route change.
- The first time a returning user lands on the site after the flip, show the **Unlock Moment** screen instead of the landing or returning-visitor screen.

### Tilt

`useTilt` hook in `system.jsx`. Cursor-following 3D rotation, max ±10deg, rAF-throttled, bailed on reduced motion. Apply to the verdict card on reveal and to the OG-preview card on hover. **Do not apply to the duel cards** — they're tap targets, not display objects.

### Image slots (and your replacement for them)

The `<image-slot>` web component in the prototype lets the reviewer drop their own portraits to validate the era treatment composes against real photos. For production, decide:

- **Option A — user-supplied** (faithful to prototype, lowest legal exposure): keep drag-and-drop, store images in localStorage only, never upload. The product becomes "your fan poll, with your photos."
- **Option B — curated** (more polished, more legal work): source officially licensed or CC press stills; serve from your CDN.

Either way: the **era-treatment overlay must remain non-destructive** — it sits on top of the portrait, never baked in. That's how the same photo of an actor reads as "1995" in one card and "2026" in another.

### Sound

Off by default, advertised via `<MuteToggle>`. The brief mentions audio; tracks aren't specified. When wiring, store the mute state per-session in localStorage and respect `prefers-reduced-motion` as a hint to also default audio off (some users couple the two).

---

## State management (suggested shape)

```ts
type RunState = {
  phase: "landing" | "duel" | "verdict" | "share";
  step: number; // 0..8
  picks: ("old" | "new")[]; // length === step (or 9 once complete)
  duelState: "idle" | "pickedOld" | "pickedNew";
  muted: boolean;
};

type GlobalState = {
  scoreboardUnlocked: boolean; // server-driven
  hasVoted: boolean; // per-browser
  priorRun?: RunResult; // localStorage if hasVoted
  crowdStats: Record<FighterId, { old: number; new: number; total: number }>;
};
```

`RunState` lives in component-local state (or a single Zustand/Context store). `GlobalState` is server-fetched on mount and refreshed on phase transitions.

---

## Assets

### Fonts

All Google Fonts — see the `<link>` in `OLD BLOOD NEW BLOOD.html`. Self-host for production to dodge the GDPR/perf cost.

### Imagery

None shipped. The prototype uses `<image-slot>` placeholders and abstract SVG silhouettes (encoded inline in `system.jsx`). Replace per the legal/sourcing decision above.

### Iconography

None — the design is deliberately type- and color-driven. The mute dot, contrarian needle, and progress dots are all CSS shapes. Don't introduce an icon library.

---

## Files in this bundle

```
design_handoff_old_blood_new_blood/
├── README.md                              ← this file
└── design-reference/
    ├── OLD BLOOD NEW BLOOD.html           ← entry point — open in browser
    ├── styles.css                         ← the design system (port this directly)
    ├── image-slot.js                      ← drag-and-drop web component
    ├── design-canvas.jsx                  ← review wrapper (not for production)
    ├── tweaks-panel.jsx                   ← variant toggles (not for production)
    └── src/
        ├── system.jsx                     ← FIGHTERS data, EraCard, BrandMark, primitives
        ├── cards.jsx                      ← VerdictCardA/B/C, ARCHETYPE_SETS, OldNewBar
        ├── screens.jsx                    ← Landing, Duel, Scoreboard, Share, Reveal, etc.
        ├── run.jsx                        ← PlayableRun — the live state machine
        └── app.jsx                        ← design-canvas + Tweaks orchestrator (not for production)
```

To view the prototype: open `design-reference/OLD BLOOD NEW BLOOD.html` in a modern browser. The design canvas is pan-and-zoomable; every screen and state is laid out for review. Click into the **Live playable run** artboard to play through the actual 9-duel loop.

The Tweaks panel (top-right toggle) flips:

- Split intensity (subtle / balanced / aggressive)
- Button shape (banner / chamfer / slab / skew)
- Card shape (tomb / chamfer / slab)
- Scoreboard data stage (locked / unlocked) — flips the n=1 vs full-crowd render

Use the Tweaks to compare options before locking the production set.

---

## Open questions for the team

1. **Image strategy** — user-supplied (Option A) or curated (Option B)?
2. **Scoreboard unlock threshold** — prototype uses 30; tune from analytics on staging.
3. **Audio** — does the brief have specific tracks/stings, or do we score it?
4. **Localization** — any of the archetype copy, disclaimer, or CTAs need to translate? The mono lockups (`RAID.MMXCV`, `RAID-26`) read fine in any locale but the archetype blurbs are very English-idiom.
5. **Analytics events** — what's the event taxonomy for picks, drops, shares, reveals? Should map cleanly to the funnel (landing → 9 picks → verdict → share).
