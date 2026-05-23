# OLD BLOOD // NEW BLOOD — Build Spec

*An unofficial Mortal Kombat fan poll. Not affiliated with or endorsed by Warner Bros., New Line, or NetherRealm.*

Working title: **OLD BLOOD // NEW BLOOD**
Status: Design locked (2026-05-23) · Build pending
Owner: Aleksei

---

## 1. The concept in one line

A head-to-head "which is better?" voting game where fans settle the **1995 Mortal Kombat** movie against **Mortal Kombat 2 (2026)**, character by character — then get a shareable verdict on which era they side with.

## 2. The two pillars

- **The engine — the verdict card (works at n=1).** Every player finishes their run with a shareable "identity" card showing which era they lean toward. It needs zero crowd data to be satisfying, so it works from the very first visitor. This is the *only* growth mechanism, so it has to be good on its own.
- **The payoff — the global scoreboard (compounds over time).** Aggregated crowd votes that reveal "the internet's verdict." It can't carry launch (no crowd on day one), so it stays hidden until enough real votes accumulate, then unlocks. The engine slowly feeds the payoff.

**Riskiest assumption:** that the verdict card is share-worthy on identity alone, before any crowd data exists. If it isn't, nothing feeds the scoreboard and it never unlocks. De-risk the card first.

## 3. Locked decisions (quick reference)

| Decision | Choice |
|---|---|
| Films compared | 1995 original **vs** Mortal Kombat 2 (2026) |
| Roster | The clean 9 (characters in both films) |
| Duel question | "Which is **better**?" (blunt, debate-fueling) |
| Session flow | Linear run, **no skip**, order shuffled per session |
| Scoreboard reveal | **Global unlock** at ~25–30 plays, with a progress bar |
| Identity model | **Single-axis spectrum** + contrarian kicker once unlocked |
| Sharing | Downloadable image **and** Open Graph rich link previews |
| Backend | **Vercel** + Upstash KV (counters) + serverless functions |
| Vote integrity | Light — per-browser (localStorage) + IP rate-limit |
| Aesthetic | **Full retro-vs-modern split** (shared layout skeleton) |
| Card craft | **3D tilt on hover** (duel + verdict cards); no scratch-off |
| Crowd reveal | Clean animated bar (after vote, once unlocked) |
| Sound | Era-distinct tap impacts + 2 era voices + verdict sting + bg loop; original/royalty-free; default muted |

## 4. The roster (the clean 9)

Each duel pairs the 1995 version against the 2026 (MK2) version.

| # | Character | 1995 | 2026 (MK2) |
|---|---|---|---|
| 1 | Raiden | Christopher Lambert | Tadanobu Asano |
| 2 | Liu Kang | Robin Shou | Ludi Lin |
| 3 | Johnny Cage | Linden Ashby | Karl Urban |
| 4 | Sonya Blade | Bridgette Wilson | Jessica McNamee |
| 5 | Kitana | Talisa Soto | Adeline Rudolph |
| 6 | Shang Tsung | Cary-Hiroyuki Tagawa | Chin Han |
| 7 | Kano | Trevor Goddard | Josh Lawson |
| 8 | Scorpion | Chris Casamassa | Hiroyuki Sanada |
| 9 | Sub-Zero | François Petit | Joe Taslim |

*Possible later additions if confirmed in MK2: Goro, Reptile.*

## 5. Gameplay flow

1. Landing screen — title, one-line pitch, "Settle it" button. Progress bar toward scoreboard unlock if not yet live.
2. Run of 9 duels, shuffled order. Each screen: the character name, the two versions as cards (old left / new right, era-styled), tap to pick.
3. After a pick:
   - **Before unlock:** advance straight to the next duel (blind voting — no crowd data shown). This keeps early votes unbiased, which makes the eventual scoreboard cleaner.
   - **After unlock:** a clean bar animates in showing the crowd split ("71% chose Old Sub-Zero — you're in the minority"), then advance.
4. After duel 9 → the **verdict card**: the player's identity, their old/new split, (once unlocked) their contrarian score, plus share + replay.

## 6. Scoreboard & unlock logic

- Because the run is no-skip, every matchup accumulates votes at the same rate, so a single global threshold is clean: **board hidden until ~25–30 completed plays, then the whole thing goes live at once.**
- A progress bar ("12 plays until results unlock") is shown pre-unlock — it doubles as a return + share hook.
- Threshold is a tunable constant (`REVEAL_AT`, start at 30).
- The server is the source of truth for unlock state and never returns percentages before the threshold (so the blind-voting period can't be peeked at via the API).

## 7. Verdict card & identity system

**Single-axis spectrum**, computed from the count of *old* picks across the 9 duels:

| Old picks | Identity |
|---|---|
| 8–9 | 90s Die-Hard |
| 6–7 | Old-School |
| 4–5 | Switch-Hitter (judges each on its merits) |
| 2–3 | New-School |
| 0–1 | New Blood |

*Names are placeholders — easy to punch up.*

**Contrarian kicker (added once the board is unlocked):** compare each of the player's picks to the crowd majority; the card adds a line like "…and you defied the crowd on 4 of 9." This is the bridge between the personal identity (engine) and the global crowd (payoff), and it's the spiciest, most shareable line.

**Graceful degradation:** identity-only at n=1 → identity + contrarian kicker once data exists.

## 8. Sharing

- **v1:** render the card to an image client-side; "Share" opens the device share sheet with the image on mobile, offers download + copy-link on desktop.
- **v2:** Open Graph per-result previews — the result is encoded in the URL (e.g. a short code or `?old=7`), a serverless function generates that result's preview image, so pasting the link auto-unfurls *the player's own card*. This is the biggest viral multiplier.

## 9. Card craft & visual direction

- **Signature effect:** cursor-following **3D tilt** on hover for the duel cards and the verdict card (subtle perspective rotation + gentle lift/shadow). No scratch-off.
- **Full retro-vs-modern split:** the 1995 side styled with a warm, VHS/CRT-era treatment; the 2026 side sleek and cinematic — sitting on a **shared layout skeleton** so the two read as "two halves of one fight," not two different sites.
- Original branding only — MK-evocative, no trademarked logo/lettering. "Mortal Kombat" used descriptively in copy only.

## 10. Sound design

All audio is **original or royalty-free** — it evokes the MK vibe without using any actual film or music clips (audio, music especially, is the most aggressively policed category). Defaults **muted** with a prominent toggle; choice remembered in `localStorage`. Audio unlocks on the first tap (browsers block autoplay).

- **Era-distinct tap impacts:** the 1995 pick plays a campy, lower-fi retro-arcade hit; the 2026 pick plays a cinematic, bass-heavy modern impact. A few pitch/variant cycles per side prevent fatigue across the 9 taps.
- **Two era voices:** one campy 90s-style announcer/fighter line for *any* old pick, one gritty modern line for *any* new pick (originally performed or generated — our own one-liners, not movie quotes). 2 clips, swappable.
- **Verdict sting:** a single theatrical flourish on the identity-card reveal (once per run, so it can be big).
- **Background loop:** an original dark-techno/cinematic loop — subtle, **default off**, on the same toggle.

*Sound lifts the session (feel, completion) but doesn't survive a screenshot, so it's a polish/retention layer, not part of the share/growth engine. Per-character voice (~18 clips) is a noted v2 upgrade.*

## 11. Tech architecture

- **Frontend:** static (vanilla or a light framework), deployed on Vercel.
- **Data store:** Upstash (Redis-style KV) for counters.
- **Serverless functions (`/api`):**
  - `POST /api/vote` — `{matchup, choice}`; increments the counter; applies IP rate-limit; returns updated counts **only if** board is unlocked.
  - `GET /api/results` — returns all counts + `unlocked` boolean; withholds percentages until `REVEAL_AT`.
  - `GET /api/og` *(v2)* — generates the per-result preview image.

**Data model (KV):**
- `mk:<matchup>` → hash `{ old: <int>, new: <int>}` (e.g. `mk:raiden`).
- `mk:plays` → integer (drives unlock threshold).
- `ratelimit:<ip>` → counter with TTL (light abuse control).

## 12. Vote integrity

- One vote per matchup per browser via `localStorage` flag (prevents casual re-voting).
- Server-side IP rate-limit (KV counter + TTL) to blunt obvious spam.
- No accounts, no login — preserves frictionless tap-to-vote.

## 13. Images & legal note

- Use official promotional stills per version, with a clear "unofficial fan project, not affiliated" disclaimer and **no ads / no monetization**.
- Keep images **modular/swappable** so they can be replaced with licensed or original art if the project grows.
- *Not legal advice — copyright on the stills remains with the studios; worst-case is a takedown request.*

## 14. Build phases

- **Phase 1 — Playable prototype (deliver first).** Self-contained build: full retro/modern split look, all 9 duels, 3D-tilt cards, era-distinct sounds + two era voices + verdict sting + background loop (placeholder royalty-free audio, with a mute toggle), blind voting, verdict card with identity + downloadable image. Scoreboard + unlock behavior simulated on local/mock data so both the locked and unlocked states are viewable. No real backend. *Goal: feel the experience and pressure-test the verdict card.*
- **Phase 2 — Real backend.** Port to a Vercel project; wire `/api/vote` + `/api/results` to Upstash KV; real shared counts; IP rate-limit. Deploy walkthrough.
- **Phase 3 — Virality layer.** Open Graph per-result preview images; rich link unfurls.

## 15. Open items / next steps

- Source 18 portraits (9 old + 9 new); confirm fan-use approach; keep swappable.
- Produce/source audio: 2 era impact sets, 2 era voice lines, verdict sting, background loop (original/royalty-free; swappable).
- Finalize archetype names & card copy.
- Confirm `REVEAL_AT` threshold (start 30).
- Pick a domain.
- Verify Goro/Reptile in MK2 if max roster is ever wanted.
