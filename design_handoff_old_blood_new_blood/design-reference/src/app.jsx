// src/app.jsx — the design canvas + Tweaks orchestrator

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "split": "balanced",
  "scoreboard": "locked",
  "btnShape": "banner",
  "cardShape": "tomb"
}/*EDITMODE-END*/;

function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const splitVal = t.split === "subtle" ? 0.5 : t.split === "aggressive" ? 1.6 : 1;
  const unlocked = t.scoreboard === "unlocked";

  // Apply split intensity globally
  useEffect(() => {
    document.documentElement.style.setProperty("--split", splitVal);
  }, [splitVal]);

  // Apply shape vocabulary via data attributes on <html>
  useEffect(() => {
    document.documentElement.dataset.btnShape = t.btnShape || "banner";
    document.documentElement.dataset.cardShape = t.cardShape || "tomb";
  }, [t.btnShape, t.cardShape]);

  // sample fighters for duel screens
  const f1 = FIGHTERS[0];
  const f2 = FIGHTERS[2];

  return (
    <>
      <DesignCanvas>
        {/* ─── Fighter cards — portrait-optimized (workhorse) ─── */}
        <DCSection
          id="fighter-cards"
          title="Fighter cards · portrait-optimized"
          subtitle="The workhorse — 9 runs of these per session. Each portrait area is a real drop-target image slot: drag any image onto a card to validate the era treatment against actual photography. The era styling is a non-destructive overlay (scanlines + chromatic for old, vignette + red wash for new), so it composes correctly with any photo."
        >
          {FIGHTERS.map((f) => (
            <DCArtboard key={f.id} id={`fc-${f.id}`} label={f.name} width={360} height={300}>
              <div style={{ width: "100%", height: "100%", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, padding: 10, background: "#0a0908", containerType: "inline-size", alignItems: "center" }}>
                <EraCard fighter={f} era="old"  slotIdPrefix="hero" nameBandMode="actor"/>
                <EraCard fighter={f} era="new"  slotIdPrefix="hero" nameBandMode="actor"/>
              </div>
            </DCArtboard>
          ))}
        </DCSection>

        {/* ─── Fighter card states ─── */}
        <DCSection
          id="fighter-card-states"
          title="Fighter card · all states"
          subtitle="Same skeleton, four states: empty (placeholder), filled (drop a portrait on the empty cards above and refresh to see), picked (post-tap stamp), and disabled (the opposite card after you've picked the other side)."
        >
          <DCArtboard id="fc-idle" label="01 · Idle · empty slot" width={210} height={380}>
            <div style={{ padding: 10, height: "100%", background: "#0a0908", display: "flex", alignItems: "center" }}>
              <EraCard fighter={FIGHTERS[0]} era="old" slotIdPrefix="state" style={{ width: "100%" }}/>
            </div>
          </DCArtboard>
          <DCArtboard id="fc-idle-new" label="02 · Idle · new skin" width={210} height={380}>
            <div style={{ padding: 10, height: "100%", background: "#0a0908", display: "flex", alignItems: "center" }}>
              <EraCard fighter={FIGHTERS[0]} era="new" slotIdPrefix="state" style={{ width: "100%" }}/>
            </div>
          </DCArtboard>
          <DCArtboard id="fc-picked-old" label="03 · Picked · old" width={210} height={380}>
            <div style={{ padding: 10, height: "100%", background: "#0a0908", display: "flex", alignItems: "center" }}>
              <EraCard fighter={FIGHTERS[0]} era="old" picked slotIdPrefix="state-picked" style={{ width: "100%" }}/>
            </div>
          </DCArtboard>
          <DCArtboard id="fc-picked-new" label="04 · Picked · new" width={210} height={380}>
            <div style={{ padding: 10, height: "100%", background: "#0a0908", display: "flex", alignItems: "center" }}>
              <EraCard fighter={FIGHTERS[0]} era="new" picked slotIdPrefix="state-picked" style={{ width: "100%" }}/>
            </div>
          </DCArtboard>
          <DCArtboard id="fc-dimmed-old" label="05 · Not chosen · dimmed" width={210} height={380}>
            <div style={{ padding: 10, height: "100%", background: "#0a0908", opacity: 0.32, filter: "grayscale(0.9) brightness(0.7)", display: "flex", alignItems: "center" }}>
              <EraCard fighter={FIGHTERS[0]} era="old" slotIdPrefix="state-dim" style={{ width: "100%" }}/>
            </div>
          </DCArtboard>
          <DCArtboard id="fc-dimmed-new" label="06 · Not chosen · dimmed" width={210} height={380}>
            <div style={{ padding: 10, height: "100%", background: "#0a0908", opacity: 0.32, filter: "grayscale(0.9) brightness(0.7)", display: "flex", alignItems: "center" }}>
              <EraCard fighter={FIGHTERS[0]} era="new" slotIdPrefix="state-dim" style={{ width: "100%" }}/>
            </div>
          </DCArtboard>
        </DCSection>

        {/* ─── Verdict Card — locked direction A ─── */}
        <DCSection
          id="verdict-card-a"
          title="Verdict card · direction A (locked)"
          subtitle="The growth engine. Direction A confirmed. Showing both data states side-by-side so the n=1 launch version never looks like it's waiting for data."
        >
          <DCArtboard id="va-n1" label="A · n=1 (no crowd data)" width={340} height={425}>
            <CardFrame><VerdictCardA data="n1"/></CardFrame>
          </DCArtboard>
          <DCArtboard id="va-unlocked" label="A · with contrarian kicker" width={340} height={425}>
            <CardFrame><VerdictCardA data="unlocked"/></CardFrame>
          </DCArtboard>
          <DCArtboard id="va-current" label={`A · live (currently ${unlocked ? "unlocked" : "n=1"})`} width={340} height={425}>
            <CardFrame><VerdictCardA data={unlocked ? "unlocked" : "n1"}/></CardFrame>
          </DCArtboard>
        </DCSection>

        {/* ─── Identity outcomes — direction A × 5 archetypes ─── */}
        <DCSection
          id="identity-outcomes"
          title="All five identity outcomes"
          subtitle="The Trading Card direction across all five archetypes. Switch naming systems in Tweaks to compare copy."
        >
          {[9,7,5,3,0].map((op) => (
            <DCArtboard key={op} id={`out-${op}`} label={`${op} OLD · ${archetypeFor(op).name}`} width={280} height={350}>
              <CardFrame>
                <VerdictCardA result={{...DEMO_RESULT, oldPicks: op, newPicks: 9-op}} data={unlocked ? "unlocked" : "n1"} tilt={false}/>
              </CardFrame>
            </DCArtboard>
          ))}
        </DCSection>

        {/* ─── Landing ─── */}
        <DCSection
          id="landing"
          title="Landing"
          subtitle="Cold-open: communicate the split + the premise + a single entry point."
        >
          <DCArtboard id="landing-locked" label="Pre-unlock · progress" width={390} height={780}>
            <LandingScreen unlocked={false} playsUntil={12}/>
          </DCArtboard>
          <DCArtboard id="landing-unlocked" label="Post-unlock · scoreboard live" width={390} height={780}>
            <LandingScreen unlocked={true}/>
          </DCArtboard>
        </DCSection>

        {/* ─── Duel run ─── */}
        <DCSection
          id="duel"
          title="The duel run"
          subtitle="Shared skeleton, two skins. Tap-to-pick. After-pick states: blind (pre-unlock) and crowd-bar (post-unlock)."
        >
          <DCArtboard id="duel-idle" label="03/09 · idle (tap to pick)" width={390} height={780}>
            <DuelScreen fighter={f1} step={3} picks={["old","new"]} state="idle" slotIdPrefix="duel-idle"/>
          </DCArtboard>
          <DCArtboard id="duel-picked-blind" label="After pick · blind voting" width={390} height={780}>
            <DuelScreen fighter={f1} step={3} picks={["old","new"]} state="pickedOld" showCrowd={false} slotIdPrefix="duel-blind"/>
          </DCArtboard>
          <DCArtboard id="duel-picked-crowd" label="After pick · crowd bar reveal" width={390} height={780}>
            <DuelScreen fighter={f1} step={3} picks={["old","new"]} state="pickedOld" showCrowd={true} crowd={{old: 71, new: 29}} slotIdPrefix="duel-crowd"/>
          </DCArtboard>
          <DCArtboard id="duel-new-pick" label="After pick (new side) · crowd" width={390} height={780}>
            <DuelScreen fighter={f2} step={5} picks={["old","new","old","new"]} state="pickedNew" showCrowd={true} crowd={{old: 38, new: 62}} slotIdPrefix="duel-newpick"/>
          </DCArtboard>
        </DCSection>

        {/* ─── Desktop duel run ─── */}
        <DCSection
          id="duel-desktop"
          title="The duel run · desktop"
          subtitle="1440×900 layout. Same vocabulary, more breathing room — bigger cards, theatrical VS seam, side-by-side pick affordances. Three states: idle, locked (blind), and locked (with crowd bar reveal)."
        >
          <DCArtboard id="duel-desk-idle" label="Desktop · idle" width={1440} height={900}>
            <DesktopDuelScreen fighter={f1} step={3} picks={["old","new"]} state="idle" slotIdPrefix="desk-idle"/>
          </DCArtboard>
          <DCArtboard id="duel-desk-blind" label="Desktop · after pick · blind" width={1440} height={900}>
            <DesktopDuelScreen fighter={f1} step={3} picks={["old","new"]} state="pickedOld" slotIdPrefix="desk-blind"/>
          </DCArtboard>
          <DCArtboard id="duel-desk-crowd" label="Desktop · after pick · crowd bar" width={1440} height={900}>
            <DesktopDuelScreen fighter={f1} step={3} picks={["old","new"]} state="pickedOld" showCrowd={true} crowd={{old: 71, new: 29}} slotIdPrefix="desk-crowd"/>
          </DCArtboard>
        </DCSection>

        {/* ─── Scoreboard ─── */}
        <DCSection
          id="scoreboard"
          title="Scoreboard"
          subtitle="Hidden until ~25–30 plays. Before unlock: a countdown that doubles as a share hook."
        >
          <DCArtboard id="sb-locked" label="Locked · countdown" width={390} height={780}>
            <ScoreboardScreen unlocked={false} playsUntil={12}/>
          </DCArtboard>
          <DCArtboard id="sb-unlocked" label="Unlocked · all 9 matchups" width={390} height={780}>
            <ScoreboardScreen unlocked={true}/>
          </DCArtboard>
        </DCSection>

        {/* ─── Verdict + share ─── */}
        <DCSection
          id="verdict-end"
          title="Verdict reveal & share"
          subtitle="End-of-run beat. The card reveal earns the theatrical moment; the share sheet is the natural next step."
        >
          <DCArtboard id="verdict-reveal" label="Reveal" width={390} height={780}>
            <VerdictRevealScreen data={unlocked ? "unlocked" : "n1"}/>
          </DCArtboard>
          <DCArtboard id="share-sheet" label="Share sheet · post-reveal" width={390} height={780}>
            <ShareSheetScreen data={unlocked ? "unlocked" : "n1"}/>
          </DCArtboard>
        </DCSection>

        {/* ─── Playable run ─── */}
        <DCSection
          id="playable"
          title="Live playable run"
          subtitle="The actual end-to-end loop. Tap a card to pick; the run advances; final tap reveals the verdict card."
        >
          <DCArtboard id="run" label="Tap to play →" width={390} height={780}>
            <PlayableRun scoreboardUnlocked={unlocked}/>
          </DCArtboard>
        </DCSection>

        {/* ─── Phase 2 moments ─── */}
        <DCSection
          id="phase-2-moments"
          title="Phase 2 · the moments that depend on real data"
          subtitle="The one-time unlock event ('an event, not just a fact'), and the returning-visitor state — what someone sees on revisit once their per-browser flag says they've already voted."
        >
          <DCArtboard id="unlock-moment" label="Unlock moment · first time the board goes live" width={390} height={780}>
            <UnlockMomentScreen/>
          </DCArtboard>
          <DCArtboard id="returning-visitor" label="Returning visitor · already played, waiting for crowd" width={390} height={780}>
            <ReturningVisitorScreen playsUntil={12}/>
          </DCArtboard>
        </DCSection>

        {/* ─── OG preview ─── */}
        <DCSection
          id="og"
          title="Phase 3 — Open Graph link unfurl"
          subtitle="Server-rendered per-result preview. Same vocabulary as in-app, optimized for 1200×630 chat unfurls."
        >
          <DCArtboard id="og-card" label="OG card" width={600} height={315}>
            <OGPreview data={unlocked ? "unlocked" : "n1"}/>
          </DCArtboard>
        </DCSection>
      </DesignCanvas>

      <TweaksPanel>
        <TweakSection label="Visual"/>
        <TweakRadio
          label="Split intensity"
          value={t.split}
          options={["subtle", "balanced", "aggressive"]}
          onChange={(v) => setTweak("split", v)}
        />
        <TweakSection label="Shape language"/>
        <TweakSelect
          label="Button shape"
          value={t.btnShape}
          options={["banner", "chamfer", "slab", "skew"]}
          onChange={(v) => setTweak("btnShape", v)}
        />
        <div style={{ fontSize: 10, color: "rgba(41,38,27,.5)", marginTop: -2, lineHeight: 1.4 }}>
          banner · tapered hex tab (forged plaque) — recommended<br/>
          chamfer · diagonal corner cuts<br/>
          slab · brutalist rect with inner stroke<br/>
          skew · kinetic parallelogram
        </div>
        <TweakRadio
          label="Card shape"
          value={t.cardShape}
          options={["tomb", "chamfer", "slab"]}
          onChange={(v) => setTweak("cardShape", v)}
        />
        <div style={{ fontSize: 10, color: "rgba(41,38,27,.5)", marginTop: -2, lineHeight: 1.4 }}>
          tomb = arched top + double-stroke frame + corner pip (recommended).
        </div>
        <TweakSection label="Data stage"/>
        <TweakRadio
          label="Scoreboard"
          value={t.scoreboard}
          options={["locked", "unlocked"]}
          onChange={(v) => setTweak("scoreboard", v)}
        />
        <div style={{ fontSize: 10, color: "rgba(41,38,27,.5)", marginTop: -2, lineHeight: 1.4 }}>
          locked = pre-launch (n=1); unlocked = ~30 plays in, contrarian kicker visible.
        </div>
      </TweaksPanel>
    </>
  );
}

// ── helpers
function CardFrame({ children }) {
  // 4:5 share-card aspect; container query unit for typography scale
  return (
    <div style={{
      position: "relative", width: "100%", height: "100%",
      display: "flex", alignItems: "center", justifyContent: "center",
      background: "transparent",
      padding: 0,
    }}>
      <div style={{ width: "100%", height: "100%", containerType: "inline-size", position: "relative" }}>
        {children}
      </div>
    </div>
  );
}

// ── OG preview (1200×630-ish 2:1, designed to unfurl in chat)
// Right slab is the "visual signature": a hero-pick diptych — the one
// character the user picked AGAINST the crowd majority (their "hot take").
// Picked side fully lit, opposite side dimmed; both era treatments visible.
// In n=1 mode (no crowd yet), we fall back to the first OLD pick as hero.
function OGPreview({ data = "unlocked" }) {
  const arch = archetypeFor(DEMO_RESULT.oldPicks);
  const needlePct = (DEMO_RESULT.oldPicks / 9) * 100;

  // Hero pick — biggest contrarian moment.
  // unlocked: first pick where choice !== majority.
  // n=1: first old pick (we lean into their dominant era).
  const heroPick = (data === "unlocked"
    ? DEMO_RESULT.picks.find(p => p.majority && p.choice !== p.majority)
    : DEMO_RESULT.picks.find(p => p.choice === (arch.lean || "old"))
  ) || DEMO_RESULT.picks[0];
  const heroFighter = FIGHTERS.find(f => f.id === heroPick.fighter) || FIGHTERS[0];
  const heroPickedOld = heroPick.choice === "old";
  return (
    <div style={{ width: "100%", height: "100%", display: "grid", gridTemplateColumns: "1.3fr 1fr", background: "var(--nb-ink)", position: "relative", overflow: "hidden" }}>
      {/* Left — identity */}
      <div style={{ padding: "5%", display: "flex", flexDirection: "column", justifyContent: "space-between", position: "relative", overflow: "hidden" }}>
        <div className="era-new" style={{ position: "absolute", inset: 0, opacity: 0.7 }}/>
        <div style={{ position: "relative", zIndex: 2 }}>
          <BrandMark size={14}/>
        </div>
        <div style={{ position: "relative", zIndex: 2 }}>
          <div className="nb-mono" style={{ fontSize: 11, letterSpacing: "0.3em", color: "var(--nb-mute)" }}>VERDICT</div>
          <div className="nb-display nb-condensed" style={{ fontSize: 56, lineHeight: 0.9, color: "var(--nb-bone)", marginTop: 4, textTransform: "uppercase" }}>{arch.name}</div>
          <div style={{ fontSize: 13, color: "var(--nb-mute)", marginTop: 8, maxWidth: 360 }}>{arch.blurb}</div>
          <div style={{ marginTop: 16, display: "flex", gap: 14, alignItems: "baseline" }}>
            <span className="ob-display ob-chromatic" style={{ fontSize: 36, color: "var(--ob-bone)" }}>{DEMO_RESULT.oldPicks}</span>
            <span className="nb-mono" style={{ fontSize: 10, letterSpacing: "0.18em", color: "var(--nb-mute)" }}>OLD</span>
            <span style={{ width: 1, height: 24, background: "var(--nb-line)" }}/>
            <span className="nb-display nb-condensed" style={{ fontSize: 36, color: "var(--nb-bone)" }}>{DEMO_RESULT.newPicks}</span>
            <span className="nb-mono" style={{ fontSize: 10, letterSpacing: "0.18em", color: "var(--nb-mute)" }}>NEW</span>
            {data === "unlocked" && <>
              <span style={{ width: 1, height: 24, background: "var(--nb-line)" }}/>
              <span className="nb-display nb-condensed" style={{ fontSize: 36, color: "var(--nb-red)" }}>{DEMO_RESULT.defied}/9</span>
              <span className="nb-mono" style={{ fontSize: 10, letterSpacing: "0.18em", color: "var(--nb-mute)" }}>CONTRARIAN</span>
            </>}
          </div>
        </div>
        <div className="nb-mono" style={{ fontSize: 10, letterSpacing: "0.18em", color: "var(--nb-mute)", position: "relative", zIndex: 2 }}>
          SETTLE.OLD-BLOOD-NEW-BLOOD.APP · UNOFFICIAL FAN PROJECT
        </div>
      </div>

      {/* Right — visual signature: hero-pick diptych */}
      <div style={{ position: "relative", overflow: "hidden", borderLeft: "1px solid var(--nb-line)" }}>
        {/* era-tinted background, split by the user's lean */}
        <div style={{ position: "absolute", inset: 0, display: "flex" }}>
          <div className="era-old" style={{ width: `${needlePct}%`, opacity: 0.55 }}/>
          <div className="era-new" style={{ flex: 1, opacity: 0.85 }}/>
        </div>
        {/* the contrarian needle */}
        <div style={{ position: "absolute", top: 0, bottom: 0, left: `${needlePct}%`, width: 3, background: "var(--nb-red)", boxShadow: "0 0 24px oklch(0.55 0.24 27 / 0.7)", zIndex: 3 }}/>

        {/* hero diptych */}
        <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", padding: "6% 5% 5%", zIndex: 4 }}>
          <div className="nb-mono" style={{ fontSize: 10, letterSpacing: "0.3em", color: "var(--nb-bone)", opacity: 0.85, textAlign: "center" }}>
            {data === "unlocked" ? "BIGGEST HOT TAKE" : "SIGNATURE PICK"}
          </div>

          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: "6%", marginTop: 6 }}>
            {/* OLD half */}
            <div style={{
              width: "44%", aspectRatio: "3/4", position: "relative",
              opacity: heroPickedOld ? 1 : 0.32,
              filter: heroPickedOld ? "none" : "grayscale(0.7)",
              transition: "opacity .3s",
            }}>
              <div className="ob-portrait" style={{ position: "absolute", inset: 0, overflow: "hidden", border: heroPickedOld ? "2px solid var(--ob-bone)" : "1px solid rgba(255,255,255,0.18)", boxShadow: heroPickedOld ? "4px 4px 0 var(--ob-magenta), 4px 4px 0 2px var(--ob-ink)" : "none" }}>
                <image-slot
                  id={`og-hero-${heroFighter.id}-old`}
                  shape="rect"
                  fit="cover"
                  placeholder={`1995 · ${heroFighter.name.toUpperCase()}`}
                  style={{ position: "absolute", inset: 0, display: "block", background: "transparent" }}
                />
                <Silhouette kind={heroFighter.silhouette} era="old"/>
              </div>
              {heroPickedOld && (
                <div className="ob-display ob-chromatic" style={{
                  position: "absolute", left: "50%", bottom: -10, transform: "translateX(-50%)",
                  background: "var(--ob-bone)", color: "var(--ob-ink)",
                  fontSize: 10, padding: "3px 8px",
                  border: "2px solid var(--ob-ink)", whiteSpace: "nowrap",
                  letterSpacing: "0.05em",
                }}>OLD · 1995</div>
              )}
            </div>

            {/* tiny VS seam */}
            <div className="nb-display nb-condensed" style={{
              fontSize: 22, color: "var(--nb-bone)", opacity: 0.6,
              textShadow: "0 0 12px oklch(0.55 0.24 27 / 0.6)",
            }}>VS</div>

            {/* NEW half */}
            <div style={{
              width: "44%", aspectRatio: "3/4", position: "relative",
              opacity: !heroPickedOld ? 1 : 0.32,
              filter: !heroPickedOld ? "none" : "grayscale(0.6) brightness(0.7)",
              transition: "opacity .3s",
            }}>
              <div className="nb-portrait" style={{ position: "absolute", inset: 0, overflow: "hidden", border: !heroPickedOld ? "1px solid var(--nb-red)" : "1px solid rgba(255,255,255,0.12)", boxShadow: !heroPickedOld ? "0 10px 30px -6px oklch(0.55 0.24 27 / 0.7)" : "none" }}>
                <image-slot
                  id={`og-hero-${heroFighter.id}-new`}
                  shape="rect"
                  fit="cover"
                  placeholder={`2026 · ${heroFighter.name.toUpperCase()}`}
                  style={{ position: "absolute", inset: 0, display: "block", background: "transparent" }}
                />
                <Silhouette kind={heroFighter.silhouette} era="new"/>
              </div>
              {!heroPickedOld && (
                <div className="nb-display nb-condensed" style={{
                  position: "absolute", left: "50%", bottom: -10, transform: "translateX(-50%)",
                  background: "var(--nb-ink)", color: "var(--nb-bone)",
                  fontSize: 11, padding: "3px 10px",
                  border: "1px solid var(--nb-red)", whiteSpace: "nowrap",
                  letterSpacing: "0.1em",
                }}>NEW · 2026</div>
              )}
            </div>
          </div>

          {/* hero label */}
          <div style={{ textAlign: "center", marginTop: 8 }}>
            <div className="nb-display nb-condensed" style={{
              fontSize: 20, lineHeight: 1, color: "var(--nb-bone)",
              textShadow: "0 2px 10px rgba(0,0,0,0.7)",
              letterSpacing: "0.02em",
            }}>
              {heroPickedOld ? "OLD " : "NEW "}{heroFighter.name.toUpperCase()}
            </div>
            <div className="nb-mono" style={{ fontSize: 9, letterSpacing: "0.2em", color: "var(--nb-mute)", marginTop: 4 }}>
              {data === "unlocked"
                ? `${heroPickedOld ? "WHILE THE CROWD CHOSE NEW" : "WHILE THE CROWD CHOSE OLD"}`
                : (heroPickedOld ? heroFighter.oldActor.toUpperCase() : heroFighter.newActor.toUpperCase())
              }
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App/>);
