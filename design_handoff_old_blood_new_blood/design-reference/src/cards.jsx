// src/cards.jsx — verdict card (Direction A: Trading Card)
// 4:5 aspect, two data states ('n1' | 'unlocked').

// Five archetype outcomes, keyed by oldPicks 0..9.
const ARCHETYPE_SETS = {
  A: {
    label: "Brief baseline",
    items: [
      { range: [8, 9], name: "90s Die-Hard",  blurb: "Loyal to the campy original through and through.", lean: "old" },
      { range: [6, 7], name: "Old-School",    blurb: "Leans nostalgic with a few modern concessions.", lean: "old" },
      { range: [4, 5], name: "Switch-Hitter", blurb: "Judges each character on its own merits.", lean: "split" },
      { range: [2, 3], name: "New-School",    blurb: "Mostly team 2026 with a soft spot or two.", lean: "new" },
      { range: [0, 1], name: "New Blood",     blurb: "All in on the new era.", lean: "new" },
    ],
  },
};

function archetypeFor(oldPicks, setKey = "A") {
  const items = ARCHETYPE_SETS[setKey].items;
  return items.find(a => oldPicks >= a.range[0] && oldPicks <= a.range[1]);
}

// Mock per-fighter result data — for demos
const DEMO_RESULT = {
  oldPicks: 6,
  newPicks: 3,
  picks: [
    { fighter: "raiden",     choice: "old", majority: "new" },
    { fighter: "liukang",    choice: "old", majority: "old" },
    { fighter: "johnnycage", choice: "old", majority: "new" },
    { fighter: "sonya",      choice: "new", majority: "new" },
    { fighter: "kitana",     choice: "old", majority: "old" },
    { fighter: "shangtsung", choice: "new", majority: "new" },
    { fighter: "kano",       choice: "old", majority: "new" },
    { fighter: "scorpion",   choice: "old", majority: "old" },
    { fighter: "subzero",    choice: "new", majority: "old" },
  ],
  defied: 4,
  date: "2026.05.23",
  runId: "OB-NB-7F3A",
};

// ─────────────────────────────────────────────────────────────
// Shared bits used by multiple cards
// ─────────────────────────────────────────────────────────────
function OldNewBar({ oldPicks, newPicks, height = 16, style }) {
  const oldPct = (oldPicks / 9) * 100;
  return (
    <div style={{
      display: "flex", height, width: "100%",
      border: "1px solid rgba(0,0,0,0.4)",
      ...style,
    }}>
      <div style={{
        width: `${oldPct}%`,
        background: "repeating-linear-gradient(45deg, var(--ob-blood) 0 8px, var(--ob-magenta) 8px 16px)",
        position: "relative",
      }}>
        <div style={{
          position: "absolute", left: 6, top: "50%", transform: "translateY(-50%)",
          fontFamily: "var(--f-mono-old)", fontSize: 12, color: "var(--ob-bone)",
          textShadow: "1px 1px 0 var(--ob-ink)",
        }}>OLD · {oldPicks}</div>
      </div>
      <div style={{
        width: `${100 - oldPct}%`,
        background: "linear-gradient(90deg, var(--nb-ink), var(--nb-red))",
        position: "relative",
      }}>
        <div style={{
          position: "absolute", right: 6, top: "50%", transform: "translateY(-50%)",
          fontFamily: "var(--f-mono-new)", fontSize: 10, color: "var(--nb-bone)",
          letterSpacing: "0.1em",
        }}>NEW · {newPicks}</div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Direction A — "TRADING CARD"
// Premium physical feel. Both era treatments coexist in one frame
// with the seam-position driven by the player's lean.
// ─────────────────────────────────────────────────────────────
function VerdictCardA({ result = DEMO_RESULT, data = "n1", tilt = true, archetypeSet = "A" }) {
  const arch = archetypeFor(result.oldPicks, archetypeSet);
  const seamPct = (result.oldPicks / 9) * 100;
  const tiltRef = useTilt(tilt ? 8 : 0);

  return (
    <div ref={tiltRef} className="tilt" style={{
      width: "100%", height: "100%",
      position: "relative",
      background: "#000",
      overflow: "hidden",
    }}>
      {/* Old half */}
      <div style={{ position: "absolute", inset: 0, width: `${seamPct}%`, overflow: "hidden" }}>
        <div className="era-old" style={{ position: "absolute", inset: 0, width: `${10000/seamPct}%` }}/>
      </div>
      {/* New half */}
      <div style={{ position: "absolute", inset: 0, left: `${seamPct}%`, overflow: "hidden" }}>
        <div className="era-new" style={{ position: "absolute", inset: 0, width: `${10000/(100-seamPct)}%`, left: `-${seamPct*100/(100-seamPct)}%` }}/>
      </div>

      {/* Seam */}
      <div style={{
        position: "absolute", top: 0, bottom: 0,
        left: `${seamPct}%`, transform: "translateX(-50%)",
        width: 4, background: "var(--nb-red)", zIndex: 5,
        boxShadow: "0 0 24px oklch(0.55 0.24 27 / 0.8)",
      }}/>

      {/* Content */}
      <div className="tilt-inner" style={{
        position: "relative", zIndex: 6,
        height: "100%", padding: "5% 5% 6%",
        display: "flex", flexDirection: "column",
      }}>
        {/* Top row */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <BrandMark size={11}/>
          <div style={{ fontFamily: "var(--f-mono-new)", fontSize: 9, color: "rgba(255,255,255,0.6)", letterSpacing: "0.15em", textAlign: "right" }}>
            VERDICT · {result.date}<br/>
            <span style={{ opacity: 0.5 }}>RUN {result.runId}</span>
          </div>
        </div>

        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: "4%" }}>
          {/* Identity label, era-treated */}
          <div style={{ textAlign: "center" }}>
            <div className="nb-mono" style={{ fontSize: 11, letterSpacing: "0.3em", color: "rgba(255,255,255,0.7)", marginBottom: 8 }}>YOU ARE</div>
            <div className={arch.lean === "old" ? "ob-display ob-chromatic" : "nb-display nb-condensed"} style={{
              fontSize: "clamp(28px, 7cqw, 56px)",
              lineHeight: 0.95,
              color: "var(--nb-bone)",
              textTransform: "uppercase",
              fontFamily: arch.lean === "old" ? "var(--f-disp-old)" : "var(--f-disp-new)",
              textShadow: arch.lean === "old"
                ? "2px 0 0 var(--ob-cyan), -2px 0 0 var(--ob-magenta)"
                : "0 4px 24px oklch(0.55 0.24 27 / 0.6)",
            }}>{arch.name}</div>
            <div style={{ fontFamily: "var(--f-body-new)", fontSize: 12, color: "rgba(255,255,255,0.65)", marginTop: 10, maxWidth: "80%", margin: "10px auto 0", textWrap: "balance" }}>
              {arch.blurb}
            </div>
          </div>

          {/* Score badge */}
          <div style={{
            display: "flex", gap: 10, alignItems: "center", justifyContent: "center",
          }}>
            <div style={{ textAlign: "center" }}>
              <div className="ob-display ob-chromatic" style={{ fontSize: 36, color: "var(--ob-bone)" }}>{result.oldPicks}</div>
              <div className="ob-mono" style={{ fontSize: 11, color: "var(--ob-bone)", letterSpacing: "0.1em" }}>OLD</div>
            </div>
            <div style={{ fontFamily: "var(--f-disp-new)", fontSize: 22, color: "var(--nb-red)", opacity: 0.6 }}>—</div>
            <div style={{ textAlign: "center" }}>
              <div className="nb-display nb-condensed" style={{ fontSize: 36, color: "var(--nb-bone)" }}>{result.newPicks}</div>
              <div className="nb-mono" style={{ fontSize: 9, color: "var(--nb-bone)", letterSpacing: "0.15em" }}>NEW</div>
            </div>
          </div>
        </div>

        {/* Bottom — contrarian if unlocked, brand line if not */}
        <div style={{ marginTop: "auto" }}>
          {data === "unlocked" ? (
            <div style={{
              background: "rgba(0,0,0,0.55)",
              border: "1px solid var(--nb-red)",
              padding: "10px 14px",
              display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
            }}>
              <div>
                <div className="nb-mono" style={{ fontSize: 9, letterSpacing: "0.2em", color: "var(--nb-mute)" }}>CONTRARIAN INDEX</div>
                <div className="nb-display nb-condensed" style={{ fontSize: 18, lineHeight: 1.05, color: "var(--nb-bone)" }}>DEFIED THE CROWD ON {result.defied} OF 9</div>
              </div>
              <div className="nb-display nb-condensed" style={{
                fontSize: 40, lineHeight: 1, color: "var(--nb-red)",
                textShadow: "0 0 14px oklch(0.55 0.24 27 / 0.6)",
              }}>{result.defied}/9</div>
            </div>
          ) : (
            <div style={{
              background: "rgba(0,0,0,0.55)",
              border: "1px dashed rgba(255,255,255,0.25)",
              padding: "10px 14px",
              display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8,
            }}>
              <div className="nb-mono" style={{ fontSize: 10, letterSpacing: "0.18em", color: "var(--nb-mute)" }}>
                CONTRARIAN INDEX UNLOCKS<br/>WHEN THE CROWD CATCHES UP
              </div>
              <div style={{ display: "flex", gap: 3 }}>
                {Array.from({length:5}).map((_,i)=>(
                  <div key={i} style={{ width: 6, height: 18, background: i<2 ? "var(--nb-red)" : "rgba(255,255,255,0.15)" }}/>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const VERDICT_VARIANTS = {
  A: { name: "Trading Card", component: VerdictCardA },
};

Object.assign(window, {
  ARCHETYPE_SETS, archetypeFor, DEMO_RESULT,
  VerdictCardA,
  VERDICT_VARIANTS, OldNewBar,
});
