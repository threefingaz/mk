// src/screens.jsx — all player-facing screens
// Landing, Duel (default + after-pick blind + after-pick unlocked),
// Scoreboard (locked progress + unlocked), ShareSheet.
// Each screen renders to fit its artboard parent.

// ─────────────────────────────────────────────────────────────
// Frame — the universal phone-shaped container with disclaimer
// ─────────────────────────────────────────────────────────────
function PhoneFrame({ children, era }) {
  return (
    <div className="artboard-screen" style={{ display: "flex", flexDirection: "column", height: "100%", background: "#000" }}>
      <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>
        {children}
      </div>
      <DisclaimerRibbon/>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Landing
// ─────────────────────────────────────────────────────────────
function LandingScreen({ unlocked = false, playsUntil = 12 }) {
  // Split background — left old, right new
  return (
    <PhoneFrame>
      <div style={{ position: "absolute", inset: 0, display: "flex" }}>
        <div className="era-old" style={{ flex: 1 }}/>
        <div className="era-new" style={{ flex: 1 }}/>
      </div>

      {/* Content */}
      <div style={{ position: "absolute", inset: 0, zIndex: 4, padding: "32px 24px", display: "flex", flexDirection: "column" }}>
        {/* Top row */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div className="nb-mono" style={{ fontSize: 9, letterSpacing: "0.2em", color: "rgba(255,255,255,0.7)" }}>
            EST.<br/>2026
          </div>
          <MuteToggle muted={true}/>
        </div>

        {/* Center */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", textAlign: "center", gap: 18 }}>
          <BrandMark size={26} vertical/>

          <div style={{ marginTop: 18, maxWidth: 320 }}>
            <div className="nb-display nb-condensed" style={{
              fontSize: 30, lineHeight: 0.95,
              color: "var(--nb-bone)",
              textShadow: "0 4px 20px rgba(0,0,0,0.6)",
            }}>WHICH ERA<br/>ARE YOU?</div>
            <div style={{ fontFamily: "var(--f-body-new)", fontSize: 13, color: "rgba(255,255,255,0.78)", marginTop: 14, textWrap: "balance" }}>
              The campy original vs. the 2026 blockbuster.<br/>
              Nine duels. Sixty seconds.<br/>
              <span style={{ opacity: 0.7 }}>Settle which side of the fight you're on.</span>
            </div>
          </div>

          {/* Two mini era previews — the landing marquee.
              Same character, two eras, flanking a VS. Sub-Zero is the
              spec's reference character (the "71% chose Old Sub-Zero…"
              example) and reads at thumbnail in both eras. */}
          <div style={{ display: "flex", gap: 10, marginTop: 18, alignItems: "center" }}>
            <div style={{ width: 96, height: 128, position: "relative" }}>
              <div className="ob-portrait" style={{ position: "absolute", inset: 0, borderRadius: 2, overflow: "hidden" }}>
                <image-slot
                  id="landing-marquee-old"
                  shape="rect"
                  fit="cover"
                  placeholder="1995 · SUB-ZERO (PETIT)"
                  style={{ position: "absolute", inset: 0, display: "block", background: "transparent" }}
                />
                <Silhouette kind="stance" era="old"/>
                <div style={{ position: "absolute", bottom: 4, left: 4, right: 4, background: "var(--ob-bone)", color: "var(--ob-ink)", fontFamily: "var(--f-disp-old)", fontSize: 10, padding: "2px 4px", textAlign: "center", boxShadow: "1px 1px 0 var(--ob-ink)", zIndex: 5 }}>SUB-ZERO · 1995</div>
              </div>
            </div>
            <div className="nb-display nb-condensed" style={{ fontSize: 26, color: "var(--nb-red)", textShadow: "0 0 14px oklch(0.55 0.24 27 / 0.7)" }}>VS</div>
            <div style={{ width: 96, height: 128, position: "relative" }}>
              <div className="nb-portrait" style={{ position: "absolute", inset: 0, overflow: "hidden" }}>
                <image-slot
                  id="landing-marquee-new"
                  shape="rect"
                  fit="cover"
                  placeholder="2026 · SUB-ZERO (TASLIM)"
                  style={{ position: "absolute", inset: 0, display: "block", background: "transparent" }}
                />
                <Silhouette kind="stance" era="new"/>
                <div style={{ position: "absolute", bottom: 4, left: 4, right: 4, color: "var(--nb-bone)", fontFamily: "var(--f-disp-new)", fontSize: 11, padding: "2px 4px", textAlign: "center", borderTop: "1px solid var(--nb-line)", letterSpacing: "0.1em", fontStretch: "condensed", fontWeight: 700, background: "rgba(0,0,0,0.6)", zIndex: 5 }}>SUB-ZERO · 2026</div>
              </div>
            </div>
          </div>

          <button className="btn-new btn-new-red" style={{ marginTop: 22, fontSize: 18, letterSpacing: "0.08em", padding: "18px 36px" }}>
            SETTLE IT →
          </button>

          {!unlocked && (
            <div style={{ marginTop: 20, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
              <div style={{ fontFamily: "var(--f-mono-new)", fontSize: 10, letterSpacing: "0.18em", color: "var(--nb-mute)" }}>
                CROWD VERDICT LOCKED
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ width: 120, height: 4, background: "rgba(255,255,255,0.15)", position: "relative", overflow: "hidden" }}>
                  <div style={{ height: "100%", background: "var(--nb-red)", width: `${((30-playsUntil)/30)*100}%` }}/>
                </div>
                <div className="nb-display nb-condensed" style={{ fontSize: 13, color: "var(--nb-bone)" }}>{playsUntil} PLAYS LEFT</div>
              </div>
            </div>
          )}
          {unlocked && (
            <div style={{ marginTop: 20, display: "flex", alignItems: "center", gap: 8, padding: "6px 12px", border: "1px solid var(--nb-red)", background: "rgba(0,0,0,0.4)" }}>
              <div style={{ width: 8, height: 8, background: "var(--nb-red)", animation: "pulse-red 1.6s infinite" }}/>
              <div className="nb-mono" style={{ fontSize: 11, letterSpacing: "0.2em", color: "var(--nb-bone)" }}>SCOREBOARD · LIVE</div>
            </div>
          )}
        </div>
      </div>
    </PhoneFrame>
  );
}

// ─────────────────────────────────────────────────────────────
// Duel screen — old left, new right; same skeleton
// ─────────────────────────────────────────────────────────────
function DuelScreen({
  fighter = FIGHTERS[0],
  step = 3,
  total = 9,
  picks = [],
  state = "idle",     // 'idle' | 'pickedOld' | 'pickedNew'
  showCrowd = false,  // post-unlock crowd bar
  crowd = { old: 71, new: 29 },
  tilt = true,
  slotIdPrefix = "duel",
}) {
  const pickedOld = state === "pickedOld";
  const pickedNew = state === "pickedNew";
  const picked = pickedOld || pickedNew;
  const tiltOld = useTilt(tilt && !picked ? 10 : 0);
  const tiltNew = useTilt(tilt && !picked ? 10 : 0);

  return (
    <PhoneFrame>
      {/* Split background */}
      <div style={{ position: "absolute", inset: 0, display: "flex" }}>
        <div className="era-old" style={{ flex: 1 }}/>
        <div className="era-new" style={{ flex: 1 }}/>
      </div>

      <div style={{ position: "absolute", inset: 0, zIndex: 4, padding: "20px 10px 12px", display: "flex", flexDirection: "column", gap: 10 }}>
        {/* Top — brand + progress */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, padding: "0 4px" }}>
          <BrandMark size={10}/>
          <div className="nb-mono" style={{ fontSize: 10, color: "var(--nb-bone)", letterSpacing: "0.2em" }}>
            {String(step).padStart(2,"0")}/{String(total).padStart(2,"0")}
          </div>
        </div>
        <div style={{ padding: "0 4px" }}>
          <ProgressDots total={total} current={step-1} picks={picks}/>
        </div>

        {/* Character anchor — the single place the character name appears */}
        <div style={{ textAlign: "center", marginTop: 2 }}>
          <div className="nb-mono" style={{ fontSize: 9, color: "var(--nb-mute)", letterSpacing: "0.3em" }}>WHICH IS BETTER</div>
          <div className="nb-display nb-condensed" style={{
            fontSize: 30, lineHeight: 1, color: "var(--nb-bone)",
            textShadow: "0 2px 12px rgba(0,0,0,0.6)",
            marginTop: 4,
          }}>{fighter.name.toUpperCase()}</div>
        </div>

        {/* The two cards — wider for portraits, only actor names on cards */}
        <div style={{ flex: 1, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, alignItems: "center", minHeight: 0 }}>
          <div ref={tiltOld} className="tilt" style={{ display: "flex", opacity: pickedNew ? 0.32 : 1, filter: pickedNew ? "grayscale(0.9) brightness(0.7)" : "none", transition: "opacity .25s, filter .25s" }}>
            <div className="tilt-inner" style={{ flex: 1, display: "flex" }}>
              <EraCard fighter={fighter} era="old" picked={pickedOld} slotIdPrefix={slotIdPrefix} nameBandMode="actor" style={{ flex: 1 }}/>
            </div>
          </div>
          <div ref={tiltNew} className="tilt" style={{ display: "flex", opacity: pickedOld ? 0.32 : 1, filter: pickedOld ? "grayscale(0.9) brightness(0.7)" : "none", transition: "opacity .25s, filter .25s" }}>
            <div className="tilt-inner" style={{ flex: 1, display: "flex" }}>
              <EraCard fighter={fighter} era="new" picked={pickedNew} slotIdPrefix={slotIdPrefix} nameBandMode="actor" style={{ flex: 1 }}/>
            </div>
          </div>
        </div>

        {/* Bottom row — depends on state */}
        {state === "idle" && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div style={{ textAlign: "center", padding: "10px 4px", background: "rgba(0,0,0,0.5)", border: "1px solid rgba(255,255,255,0.1)" }}>
              <div className="ob-mono" style={{ fontSize: 13, color: "var(--ob-bone)", letterSpacing: "0.1em" }}>TAP TO PICK</div>
              <div className="ob-display ob-chromatic" style={{ fontSize: 16, color: "var(--ob-bone)", marginTop: 2 }}>OLD BLOOD</div>
            </div>
            <div style={{ textAlign: "center", padding: "10px 4px", background: "rgba(0,0,0,0.5)", border: "1px solid rgba(255,255,255,0.15)" }}>
              <div className="nb-mono" style={{ fontSize: 9, color: "var(--nb-mute)", letterSpacing: "0.2em" }}>TAP TO PICK</div>
              <div className="nb-display nb-condensed" style={{ fontSize: 18, color: "var(--nb-bone)", marginTop: 2 }}>NEW BLOOD</div>
            </div>
          </div>
        )}

        {picked && !showCrowd && (
          <div style={{
            background: "rgba(0,0,0,0.65)",
            border: `1px solid ${pickedOld ? "var(--ob-magenta)" : "var(--nb-red)"}`,
            padding: "12px 14px",
            display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
            animation: "reveal-up .35s",
          }}>
            <div>
              <div className="nb-mono" style={{ fontSize: 9, letterSpacing: "0.22em", color: "var(--nb-mute)" }}>YOUR PICK · LOCKED</div>
              <div className={pickedOld ? "ob-display ob-chromatic" : "nb-display nb-condensed"} style={{
                fontSize: 20, lineHeight: 1, color: "var(--nb-bone)", marginTop: 4,
              }}>{pickedOld ? `OLD BLOOD · 1995` : `NEW BLOOD · 2026`}</div>
              <div style={{ fontSize: 11, color: "var(--nb-mute)", marginTop: 4 }}>Vote sealed. Crowd verdict reveals when the scoreboard unlocks.</div>
            </div>
            <button className="btn-new btn-new-red" style={{ fontSize: 13, padding: "10px 14px" }}>NEXT →</button>
          </div>
        )}

        {picked && showCrowd && (
          <div style={{
            background: "rgba(0,0,0,0.65)",
            border: `1px solid ${pickedOld ? "var(--ob-magenta)" : "var(--nb-red)"}`,
            padding: "12px 14px",
            animation: "reveal-up .35s",
          }}>
            <div className="nb-mono" style={{ fontSize: 9, letterSpacing: "0.22em", color: "var(--nb-mute)" }}>THE CROWD SAYS</div>
            <div style={{ display: "flex", height: 22, marginTop: 6, border: "1px solid rgba(255,255,255,0.2)" }}>
              <div style={{
                width: `${crowd.old}%`,
                background: "repeating-linear-gradient(45deg, var(--ob-blood) 0 8px, var(--ob-magenta) 8px 16px)",
                display: "flex", alignItems: "center", justifyContent: "flex-start", paddingLeft: 8,
                fontFamily: "var(--f-mono-old)", fontSize: 14, color: "var(--ob-bone)", textShadow: "1px 1px 0 var(--ob-ink)",
                animation: "barfill .6s ease-out",
              }}>{crowd.old}%</div>
              <div style={{
                width: `${crowd.new}%`,
                background: "linear-gradient(90deg, var(--nb-ink-2), var(--nb-red))",
                display: "flex", alignItems: "center", justifyContent: "flex-end", paddingRight: 8,
                fontFamily: "var(--f-mono-new)", fontSize: 11, color: "var(--nb-bone)", letterSpacing: "0.1em",
                animation: "barfill .6s ease-out .15s both",
              }}>{crowd.new}%</div>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8, gap: 12 }}>
              <div className="nb-display nb-condensed" style={{ fontSize: 15, color: "var(--nb-bone)", lineHeight: 1.1 }}>
                {(() => {
                  const yourSide = pickedOld ? crowd.old : crowd.new;
                  const sideName = pickedOld ? `OLD ${fighter.name.toUpperCase()}` : `NEW ${fighter.name.toUpperCase()}`;
                  return yourSide > 50
                    ? `${yourSide}% CHOSE ${sideName} — YOU RAN WITH THE CROWD`
                    : `${100-yourSide}% CHOSE THE OTHER — YOU'RE IN THE MINORITY`;
                })()}
              </div>
              <button className="btn-new btn-new-red" style={{ fontSize: 13, padding: "10px 14px" }}>NEXT →</button>
            </div>
          </div>
        )}
      </div>
    </PhoneFrame>
  );
}

// ─────────────────────────────────────────────────────────────
// Scoreboard — locked progress + unlocked rows
// ─────────────────────────────────────────────────────────────
function ScoreboardScreen({ unlocked = false, playsUntil = 12 }) {
  return (
    <PhoneFrame>
      <div className="era-new" style={{ position: "absolute", inset: 0 }}/>

      <div style={{ position: "absolute", inset: 0, zIndex: 4, padding: "24px 20px", display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <BrandMark size={11}/>
          <div className="nb-mono" style={{ fontSize: 9, letterSpacing: "0.2em", color: "var(--nb-mute)" }}>SCOREBOARD</div>
        </div>

        <div>
          <div className="nb-mono" style={{ fontSize: 10, letterSpacing: "0.25em", color: "var(--nb-mute)" }}>THE INTERNET'S VERDICT</div>
          <div className="nb-display nb-condensed" style={{ fontSize: 36, lineHeight: 1, color: "var(--nb-bone)", marginTop: 4 }}>
            {unlocked ? "RESULTS · LIVE" : "RESULTS · LOCKED"}
          </div>
        </div>

        {!unlocked && (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", gap: 18 }}>
            <div style={{
              border: "1px solid var(--nb-line)", background: "rgba(255,255,255,0.02)",
              padding: 20, textAlign: "center",
            }}>
              <div style={{ fontSize: 14, color: "var(--nb-mute)", marginBottom: 12, textWrap: "balance" }}>
                The crowd verdict unlocks for everyone when there are enough votes to keep it honest.
              </div>
              <div className="nb-display nb-condensed" style={{ fontSize: 64, lineHeight: 0.9, color: "var(--nb-red)" }}>
                {playsUntil}
              </div>
              <div className="nb-mono" style={{ fontSize: 10, letterSpacing: "0.2em", color: "var(--nb-mute)" }}>PLAYS UNTIL UNLOCK</div>

              <div style={{ marginTop: 18, height: 6, background: "rgba(255,255,255,0.08)", position: "relative", overflow: "hidden" }}>
                <div style={{ height: "100%", background: "linear-gradient(90deg, var(--nb-red-2), var(--nb-red))", width: `${((30-playsUntil)/30)*100}%` }}/>
              </div>
              <div className="nb-mono" style={{ fontSize: 9, letterSpacing: "0.2em", color: "var(--nb-mute)", marginTop: 8, display: "flex", justifyContent: "space-between" }}>
                <span>{30-playsUntil} / 30</span>
                <span>SHARE TO HELP UNLOCK</span>
              </div>
            </div>

            <button className="btn-new" style={{ alignSelf: "stretch", textAlign: "center", justifyContent: "center", padding: "14px" }}>
              SHARE YOUR VERDICT →
            </button>
          </div>
        )}

        {unlocked && (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6, overflow: "auto" }}>
            {FIGHTERS.map((f, i) => {
              const oldPct = 30 + ((i * 13) % 50);
              return (
                <div key={f.id} style={{
                  display: "grid", gridTemplateColumns: "1fr",
                  gap: 6,
                  padding: "8px 0 10px",
                  borderBottom: "1px solid var(--nb-line)",
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
                    <div className="nb-display nb-condensed" style={{ fontSize: 16, lineHeight: 1, color: "var(--nb-bone)" }}>
                      {f.name.toUpperCase()}
                    </div>
                    <div className="nb-mono" style={{ fontSize: 9, letterSpacing: "0.18em", color: "var(--nb-mute)" }}>
                      {String(i+1).padStart(2,"0")}/09
                    </div>
                  </div>
                  <div style={{ display: "flex", height: 20, border: "1px solid var(--nb-line)" }}>
                    <div style={{
                      width: `${oldPct}%`,
                      background: "repeating-linear-gradient(45deg, var(--ob-blood) 0 6px, var(--ob-magenta) 6px 12px)",
                      display: "flex", alignItems: "center", justifyContent: "flex-start", paddingLeft: 6,
                      fontFamily: "var(--f-mono-old)", fontSize: 12, color: "var(--ob-bone)",
                      textShadow: "1px 1px 0 var(--ob-ink)",
                    }}>{oldPct}</div>
                    <div style={{
                      width: `${100-oldPct}%`,
                      background: "linear-gradient(90deg, var(--nb-ink-2), var(--nb-red))",
                      display: "flex", alignItems: "center", justifyContent: "flex-end", paddingRight: 6,
                      fontFamily: "var(--f-mono-new)", fontSize: 10, color: "var(--nb-bone)", letterSpacing: "0.1em",
                    }}>{100-oldPct}</div>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontFamily: "var(--f-mono-new)", fontSize: 9, letterSpacing: "0.05em" }}>
                    <span style={{ color: "var(--ob-bone)", opacity: 0.85 }}>{f.oldActor} <span style={{ color: "var(--nb-mute)" }}>· 1995</span></span>
                    <span style={{ color: "var(--nb-bone)", opacity: 0.85 }}><span style={{ color: "var(--nb-mute)" }}>2026 ·</span> {f.newActor}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </PhoneFrame>
  );
}

// ─────────────────────────────────────────────────────────────
// Share Sheet — what the player sees right after the verdict card
// ─────────────────────────────────────────────────────────────
function ShareSheetScreen({ data = "unlocked", archetypeSet = "A" }) {
  const VariantCard = VerdictCardA;
  return (
    <PhoneFrame>
      <div className="era-new" style={{ position: "absolute", inset: 0 }}/>

      <div style={{ position: "absolute", inset: 0, zIndex: 4, padding: "24px 20px 12px", display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <button style={{ background: "transparent", border: 0, color: "var(--nb-mute)", fontFamily: "var(--f-mono-new)", fontSize: 11, letterSpacing: "0.18em", cursor: "pointer" }}>← BACK</button>
          <BrandMark size={10}/>
          <div style={{ width: 56 }}/>
        </div>

        <div style={{ textAlign: "center" }}>
          <div className="nb-mono" style={{ fontSize: 10, letterSpacing: "0.3em", color: "var(--nb-mute)" }}>YOUR VERDICT IS READY</div>
          <div className="nb-display nb-condensed" style={{ fontSize: 24, lineHeight: 1, color: "var(--nb-bone)", marginTop: 4 }}>POST IT. STAKE YOUR FLAG.</div>
        </div>

        {/* The card preview, scaled */}
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{
            width: "78%", aspectRatio: "4/5",
            boxShadow: "0 24px 60px -10px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.08)",
            containerType: "inline-size",
          }}>
            <VariantCard data={data} archetypeSet={archetypeSet}/>
          </div>
        </div>

        {/* Share actions */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <button className="btn-new btn-new-red" style={{ fontSize: 13, padding: "14px", justifyContent: "center", textAlign: "center" }}>SHARE ↗</button>
          <button className="btn-new" style={{ fontSize: 13, padding: "14px", justifyContent: "center", textAlign: "center" }}>SAVE IMAGE ↓</button>
        </div>
        <div style={{ display: "flex", justifyContent: "center", gap: 14, marginTop: -4 }}>
          <span className="nb-mono" style={{ fontSize: 10, letterSpacing: "0.18em", color: "var(--nb-mute)", cursor: "pointer" }}>COPY LINK</span>
          <span className="nb-mono" style={{ fontSize: 10, letterSpacing: "0.18em", color: "var(--nb-mute)", cursor: "pointer" }}>RUN AGAIN ↻</span>
        </div>
      </div>
    </PhoneFrame>
  );
}

// ─────────────────────────────────────────────────────────────
// Verdict screen — the big reveal moment in the app
// ─────────────────────────────────────────────────────────────
function VerdictRevealScreen({ data = "n1", archetypeSet = "A" }) {
  const VariantCard = VerdictCardA;
  return (
    <PhoneFrame>
      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, oklch(0.10 0.02 27) 0%, oklch(0.05 0.005 270) 100%)" }}/>
      <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse at 50% 30%, oklch(0.40 0.20 27 / 0.45), transparent 60%)" }}/>

      <div style={{ position: "absolute", inset: 0, zIndex: 4, padding: "20px", display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ textAlign: "center" }}>
          <div className="nb-mono" style={{ fontSize: 9, letterSpacing: "0.4em", color: "var(--nb-red)" }}>·  VERDICT  ·</div>
          <div className="nb-display nb-condensed" style={{ fontSize: 14, color: "var(--nb-mute)", marginTop: 4, letterSpacing: "0.18em" }}>9 OF 9 SETTLED</div>
        </div>

        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{
            width: "82%", aspectRatio: "4/5",
            boxShadow: "0 30px 80px -10px oklch(0.45 0.22 27 / 0.5), 0 0 0 1px rgba(255,255,255,0.08)",
            animation: "reveal-up .8s cubic-bezier(.2,.7,.3,1)",
            containerType: "inline-size",
          }}>
            <VariantCard data={data} archetypeSet={archetypeSet}/>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <button className="btn-new btn-new-red" style={{ fontSize: 14, padding: "14px", justifyContent: "center", textAlign: "center" }}>SHARE ↗</button>
          <button className="btn-new" style={{ fontSize: 14, padding: "14px", justifyContent: "center", textAlign: "center" }}>RUN AGAIN ↻</button>
        </div>
      </div>
    </PhoneFrame>
  );
}

// ─────────────────────────────────────────────────────────────
// Unlock moment — the one-time celebratory event when the
// scoreboard goes live. Spec describes this as "an event."
// ─────────────────────────────────────────────────────────────
function UnlockMomentScreen() {
  return (
    <PhoneFrame>
      <div className="era-new" style={{ position: "absolute", inset: 0 }}/>
      <div style={{
        position: "absolute", inset: 0,
        background: "radial-gradient(ellipse at 50% 40%, oklch(0.55 0.24 27 / 0.45), transparent 60%)",
      }}/>

      <div style={{ position: "absolute", inset: 0, zIndex: 4, padding: "24px 20px", display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <BrandMark size={11}/>
          <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 10px", border: "1px solid var(--nb-red)", background: "rgba(0,0,0,0.4)" }}>
            <div style={{ width: 6, height: 6, background: "var(--nb-red)", animation: "pulse-red 1.4s infinite" }}/>
            <div className="nb-mono" style={{ fontSize: 9, letterSpacing: "0.2em", color: "var(--nb-bone)" }}>LIVE</div>
          </div>
        </div>

        {/* The announcement */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", textAlign: "center", gap: 12 }}>
          <div className="nb-mono" style={{ fontSize: 10, letterSpacing: "0.4em", color: "var(--nb-red)", animation: "glitch-x 4s infinite" }}>·  ALL VOTES IN  ·</div>
          <div className="nb-display nb-condensed" style={{
            fontSize: 72, lineHeight: 0.85,
            color: "var(--nb-bone)",
            letterSpacing: "0.005em",
            textShadow: "0 6px 30px oklch(0.55 0.24 27 / 0.5)",
            animation: "reveal-up .8s cubic-bezier(.2,.7,.3,1)",
          }}>RESULTS<br/>UNLOCKED</div>

          <div style={{ fontSize: 13, color: "var(--nb-mute)", maxWidth: 280, marginTop: 8, textWrap: "balance" }}>
            The crowd hit 30 plays. The verdict is live for everyone — including your run from last week.
          </div>

          {/* Mini preview of what's behind it */}
          <div style={{
            width: "85%", marginTop: 24,
            border: "1px solid var(--nb-line)", background: "rgba(0,0,0,0.4)",
            padding: 12,
          }}>
            <div className="nb-mono" style={{ fontSize: 9, letterSpacing: "0.2em", color: "var(--nb-mute)", marginBottom: 8 }}>YOUR LAST RUN · NOW WITH CROWD</div>
            <div style={{ display: "flex", gap: 8, alignItems: "center", justifyContent: "space-between" }}>
              <div className="nb-display nb-condensed" style={{ fontSize: 22, color: "var(--nb-bone)" }}>OLD-SCHOOL</div>
              <div className="nb-display nb-condensed" style={{ fontSize: 22, color: "var(--nb-red)" }}>4/9</div>
            </div>
            <div className="nb-mono" style={{ fontSize: 10, letterSpacing: "0.1em", color: "var(--nb-mute)", marginTop: 4, textAlign: "right" }}>CONTRARIAN</div>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <button className="btn-new btn-new-red" style={{ fontSize: 14, padding: "14px", justifyContent: "center", textAlign: "center" }}>SEE THE BOARD →</button>
          <button className="btn-new" style={{ fontSize: 14, padding: "14px", justifyContent: "center", textAlign: "center" }}>NEW VERDICT ↗</button>
        </div>
      </div>
    </PhoneFrame>
  );
}

// ─────────────────────────────────────────────────────────────
// Returning visitor — they've already cast votes (per-browser
// localStorage flag). Show them their run, the crowd progress,
// and the share hook.
// ─────────────────────────────────────────────────────────────
function ReturningVisitorScreen({ playsUntil = 12, archetypeSet = "A" }) {
  const VariantCard = VerdictCardA;
  return (
    <PhoneFrame>
      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, oklch(0.10 0.02 27) 0%, oklch(0.06 0.005 270) 100%)" }}/>

      <div style={{ position: "absolute", inset: 0, zIndex: 4, padding: "24px 20px 16px", display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <BrandMark size={11}/>
          <MuteToggle muted={true}/>
        </div>

        <div>
          <div className="nb-mono" style={{ fontSize: 10, letterSpacing: "0.3em", color: "var(--nb-mute)" }}>WELCOME BACK</div>
          <div className="nb-display nb-condensed" style={{ fontSize: 28, lineHeight: 1, color: "var(--nb-bone)", marginTop: 4 }}>YOUR VERDICT'S STILL HERE</div>
        </div>

        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{
            width: "76%", aspectRatio: "4/5",
            boxShadow: "0 24px 60px -10px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.08)",
            containerType: "inline-size",
          }}>
            <VariantCard data="n1" archetypeSet={archetypeSet} tilt={false}/>
          </div>
        </div>

        {/* Progress to unlock */}
        <div style={{
          border: "1px solid var(--nb-line)", background: "rgba(255,255,255,0.02)",
          padding: "12px 14px",
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
            <div className="nb-mono" style={{ fontSize: 10, letterSpacing: "0.2em", color: "var(--nb-mute)" }}>CROWD VERDICT LOCKED</div>
            <div className="nb-display nb-condensed" style={{ fontSize: 16, color: "var(--nb-bone)" }}>{playsUntil} PLAYS LEFT</div>
          </div>
          <div style={{ height: 6, background: "rgba(255,255,255,0.08)", position: "relative", overflow: "hidden" }}>
            <div style={{ height: "100%", background: "linear-gradient(90deg, var(--nb-red-2), var(--nb-red))", width: `${((30-playsUntil)/30)*100}%` }}/>
          </div>
          <div className="nb-mono" style={{ fontSize: 9, letterSpacing: "0.18em", color: "var(--nb-mute)", marginTop: 6 }}>
            SHARE YOUR CARD TO HELP UNLOCK. WE'LL EMAIL — JUST KIDDING, COME BACK.
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <button className="btn-new btn-new-red" style={{ fontSize: 13, padding: "14px", justifyContent: "center", textAlign: "center" }}>SHARE ↗</button>
          <button className="btn-new" style={{ fontSize: 13, padding: "14px", justifyContent: "center", textAlign: "center" }}>NEW RUN ↻</button>
        </div>
      </div>
    </PhoneFrame>
  );
}

Object.assign(window, {
  PhoneFrame, LandingScreen, DuelScreen,
  ScoreboardScreen, ShareSheetScreen, VerdictRevealScreen,
  UnlockMomentScreen, ReturningVisitorScreen,
  DesktopDuelScreen,
});

// ─────────────────────────────────────────────────────────────
// Desktop duel — 1440×900 layout
// Same vocabulary as mobile: split background, two cards, VS seam,
// pick affordances. Bigger margins, bigger type, side-by-side everything.
// ─────────────────────────────────────────────────────────────
function DesktopDuelScreen({
  fighter = FIGHTERS[0],
  step = 3,
  total = 9,
  picks = [],
  state = "idle",
  showCrowd = false,
  crowd = { old: 71, new: 29 },
  tilt = true,
  slotIdPrefix = "desk",
}) {
  const pickedOld = state === "pickedOld";
  const pickedNew = state === "pickedNew";
  const picked = pickedOld || pickedNew;
  const tiltOld = useTilt(tilt && !picked ? 6 : 0);
  const tiltNew = useTilt(tilt && !picked ? 6 : 0);

  return (
    <div className="artboard-screen" style={{ display: "flex", flexDirection: "column", height: "100%", background: "#000", position: "relative" }}>
      {/* Split background */}
      <div style={{ position: "absolute", inset: 0, display: "flex" }}>
        <div className="era-old" style={{ flex: 1 }}/>
        <div className="era-new" style={{ flex: 1 }}/>
      </div>

      {/* Content */}
      <div style={{ position: "relative", zIndex: 4, flex: 1, display: "flex", flexDirection: "column", padding: "32px 64px 24px" }}>
        {/* Top bar */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "center", gap: 32 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
            <BrandMark size={14}/>
            <div className="nb-mono" style={{ fontSize: 10, color: "var(--nb-mute)", letterSpacing: "0.25em" }}>
              EST. 2026 · UNOFFICIAL
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 18, minWidth: 320 }}>
            <div className="nb-mono" style={{ fontSize: 11, color: "var(--nb-bone)", letterSpacing: "0.25em" }}>
              {String(step).padStart(2,"0")} / {String(total).padStart(2,"0")}
            </div>
            <div style={{ flex: 1, minWidth: 240 }}>
              <ProgressDots total={total} current={step-1} picks={picks}/>
            </div>
          </div>
          <div style={{ justifySelf: "end" }}>
            <MuteToggle muted={true}/>
          </div>
        </div>

        {/* Headline */}
        <div style={{ textAlign: "center", marginTop: 24 }}>
          <div className="nb-mono" style={{ fontSize: 12, color: "var(--nb-mute)", letterSpacing: "0.4em" }}>
            WHICH IS BETTER
          </div>
          <div className="nb-display nb-condensed" style={{
            fontSize: 72, lineHeight: 0.9, color: "var(--nb-bone)",
            textShadow: "0 4px 24px rgba(0,0,0,0.7)",
            marginTop: 8, letterSpacing: "0.01em",
          }}>{fighter.name.toUpperCase()}</div>
        </div>

        {/* Cards arena */}
        <div style={{
          flex: 1, marginTop: 20,
          display: "grid",
          gridTemplateColumns: "1fr 120px 1fr",
          gap: 0, alignItems: "center",
          minHeight: 0,
        }}>
          <div ref={tiltOld} className="tilt" style={{
            display: "flex", justifyContent: "flex-end",
            opacity: pickedNew ? 0.3 : 1,
            filter: pickedNew ? "grayscale(0.9) brightness(0.7)" : "none",
            transition: "opacity .25s, filter .25s",
          }}>
            <div className="tilt-inner" style={{ width: "min(100%, 340px)", display: "flex" }}>
              <EraCard fighter={fighter} era="old" picked={pickedOld} slotIdPrefix={slotIdPrefix} nameBandMode="actor" style={{ flex: 1 }}/>
            </div>
          </div>

          {/* VS seam — bigger, more theatrical */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14 }}>
            <div style={{ flex: 1, width: 1, background: "linear-gradient(to bottom, transparent, var(--nb-red-2), transparent)" }}/>
            <div className="nb-display nb-condensed" style={{
              fontSize: 64, lineHeight: 1,
              color: "var(--nb-red)",
              textShadow: "0 0 32px oklch(0.55 0.24 27 / 0.7)",
            }}>VS</div>
            <div style={{ flex: 1, width: 1, background: "linear-gradient(to top, transparent, var(--nb-red-2), transparent)" }}/>
          </div>

          <div ref={tiltNew} className="tilt" style={{
            display: "flex", justifyContent: "flex-start",
            opacity: pickedOld ? 0.3 : 1,
            filter: pickedOld ? "grayscale(0.9) brightness(0.7)" : "none",
            transition: "opacity .25s, filter .25s",
          }}>
            <div className="tilt-inner" style={{ width: "min(100%, 340px)", display: "flex" }}>
              <EraCard fighter={fighter} era="new" picked={pickedNew} slotIdPrefix={slotIdPrefix} nameBandMode="actor" style={{ flex: 1 }}/>
            </div>
          </div>
        </div>

        {/* Bottom action row */}
        <div style={{ marginTop: 20, minHeight: 88 }}>
          {state === "idle" && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 120px 1fr", gap: 0, alignItems: "center" }}>
              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <div style={{ width: "min(100%, 340px)", padding: "18px 24px", background: "rgba(0,0,0,0.55)", border: "1px solid rgba(255,255,255,0.1)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
                  <div>
                    <div className="ob-mono" style={{ fontSize: 12, color: "var(--ob-bone)", letterSpacing: "0.15em" }}>TAP TO PICK</div>
                    <div className="ob-display ob-chromatic" style={{ fontSize: 22, color: "var(--ob-bone)", marginTop: 3 }}>OLD BLOOD · 1995</div>
                  </div>
                  <div className="ob-mono" style={{ fontSize: 18, color: "var(--ob-magenta)" }}>←</div>
                </div>
              </div>
              <div className="nb-mono" style={{ fontSize: 9, color: "var(--nb-mute)", letterSpacing: "0.3em", textAlign: "center" }}>OR</div>
              <div style={{ display: "flex", justifyContent: "flex-start" }}>
                <div style={{ width: "min(100%, 340px)", padding: "18px 24px", background: "rgba(0,0,0,0.55)", border: "1px solid rgba(255,255,255,0.15)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
                  <div className="nb-mono" style={{ fontSize: 16, color: "var(--nb-red)" }}>→</div>
                  <div style={{ textAlign: "right" }}>
                    <div className="nb-mono" style={{ fontSize: 10, color: "var(--nb-mute)", letterSpacing: "0.25em" }}>TAP TO PICK</div>
                    <div className="nb-display nb-condensed" style={{ fontSize: 24, color: "var(--nb-bone)", marginTop: 3 }}>NEW BLOOD · 2026</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {picked && !showCrowd && (
            <div style={{
              background: "rgba(0,0,0,0.7)",
              border: `1px solid ${pickedOld ? "var(--ob-magenta)" : "var(--nb-red)"}`,
              padding: "20px 28px",
              display: "flex", alignItems: "center", justifyContent: "space-between", gap: 24,
              animation: "reveal-up .35s",
            }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <div className="nb-mono" style={{ fontSize: 11, letterSpacing: "0.25em", color: "var(--nb-mute)" }}>YOUR PICK · LOCKED</div>
                <div className={pickedOld ? "ob-display ob-chromatic" : "nb-display nb-condensed"} style={{
                  fontSize: 32, lineHeight: 1, color: "var(--nb-bone)",
                }}>{pickedOld ? `OLD BLOOD · 1995` : `NEW BLOOD · 2026`}</div>
              </div>
              <div style={{ fontSize: 13, color: "var(--nb-mute)", maxWidth: 360, textAlign: "right" }}>
                Vote sealed. Crowd verdict reveals when the scoreboard unlocks.
              </div>
              <button className="btn-new btn-new-red" style={{ fontSize: 16, padding: "18px 32px" }}>NEXT MATCHUP →</button>
            </div>
          )}

          {picked && showCrowd && (
            <div style={{
              background: "rgba(0,0,0,0.7)",
              border: `1px solid ${pickedOld ? "var(--ob-magenta)" : "var(--nb-red)"}`,
              padding: "18px 28px",
              display: "grid", gridTemplateColumns: "auto 1fr auto", gap: 28, alignItems: "center",
              animation: "reveal-up .35s",
            }}>
              <div style={{ minWidth: 220 }}>
                <div className="nb-mono" style={{ fontSize: 10, letterSpacing: "0.25em", color: "var(--nb-mute)" }}>THE CROWD SAYS</div>
                <div className="nb-display nb-condensed" style={{ fontSize: 22, lineHeight: 1.1, color: "var(--nb-bone)", marginTop: 4 }}>
                  {(() => {
                    const yourSide = pickedOld ? crowd.old : crowd.new;
                    return yourSide > 50
                      ? `${yourSide}% AGREE WITH YOU`
                      : `${100-yourSide}% DISAGREE — YOU'RE CONTRARIAN`;
                  })()}
                </div>
              </div>
              <div style={{ display: "flex", height: 36, border: "1px solid rgba(255,255,255,0.2)" }}>
                <div style={{
                  width: `${crowd.old}%`,
                  background: "repeating-linear-gradient(45deg, var(--ob-blood) 0 10px, var(--ob-magenta) 10px 20px)",
                  display: "flex", alignItems: "center", justifyContent: "flex-start", paddingLeft: 14,
                  fontFamily: "var(--f-mono-old)", fontSize: 18, color: "var(--ob-bone)", textShadow: "1px 1px 0 var(--ob-ink)",
                  animation: "barfill .6s ease-out",
                }}>{crowd.old}%</div>
                <div style={{
                  width: `${crowd.new}%`,
                  background: "linear-gradient(90deg, var(--nb-ink-2), var(--nb-red))",
                  display: "flex", alignItems: "center", justifyContent: "flex-end", paddingRight: 14,
                  fontFamily: "var(--f-mono-new)", fontSize: 14, color: "var(--nb-bone)", letterSpacing: "0.12em",
                  animation: "barfill .6s ease-out .15s both",
                }}>{crowd.new}%</div>
              </div>
              <button className="btn-new btn-new-red" style={{ fontSize: 16, padding: "18px 32px" }}>NEXT →</button>
            </div>
          )}
        </div>
      </div>

      <DisclaimerRibbon/>
    </div>
  );
}

Object.assign(window, { DesktopDuelScreen });
