// src/system.jsx — shared design system components
// Tokens-as-components: BrandMark, PortraitSlot, EraCard skeleton,
// ProgressDots, MuteToggle, DisclaimerRibbon, useTilt hook.

const { useState, useRef, useEffect, useCallback, useMemo } = React;

// ─────────────────────────────────────────────────────────────
// The clean 9 — characters who appear in both films.
// Names and actors per spec. Used descriptively (fan poll).
// Order shuffles per session in production; demo order is canon.
// Branding stays original — no trademarked logos, lettering, or
// franchise identity referenced visually.
// ─────────────────────────────────────────────────────────────
const FIGHTERS = [
{ id: "raiden", name: "Raiden", oldActor: "Christopher Lambert", newActor: "Tadanobu Asano", oldTag: "RAID.MMXCV", newTag: "RAID-26", silhouette: "robe" },
{ id: "liukang", name: "Liu Kang", oldActor: "Robin Shou", newActor: "Ludi Lin", oldTag: "LIUK.MMXCV", newTag: "LIUK-26", silhouette: "stance" },
{ id: "johnnycage", name: "Johnny Cage", oldActor: "Linden Ashby", newActor: "Karl Urban", oldTag: "CAGE.MMXCV", newTag: "CAGE-26", silhouette: "guard" },
{ id: "sonya", name: "Sonya Blade", oldActor: "Bridgette Wilson", newActor: "Jessica McNamee", oldTag: "SONY.MMXCV", newTag: "SONY-26", silhouette: "guard" },
{ id: "kitana", name: "Kitana", oldActor: "Talisa Soto", newActor: "Adeline Rudolph", oldTag: "KITA.MMXCV", newTag: "KITA-26", silhouette: "cape" },
{ id: "shangtsung", name: "Shang Tsung", oldActor: "Cary-Hiroyuki Tagawa", newActor: "Chin Han", oldTag: "SHNG.MMXCV", newTag: "SHNG-26", silhouette: "robe" },
{ id: "kano", name: "Kano", oldActor: "Trevor Goddard", newActor: "Josh Lawson", oldTag: "KANO.MMXCV", newTag: "KANO-26", silhouette: "stance" },
{ id: "scorpion", name: "Scorpion", oldActor: "Chris Casamassa", newActor: "Hiroyuki Sanada", oldTag: "SCRP.MMXCV", newTag: "SCRP-26", silhouette: "stance" },
{ id: "subzero", name: "Sub-Zero", oldActor: "François Petit", newActor: "Joe Taslim", oldTag: "SUB0.MMXCV", newTag: "SUB0-26", silhouette: "cape" }];


// Silhouette SVG masks (encoded inline so the era class can paint them).
// Kept abstract — recognizably "a fighter," not a specific person.
const SILHOUETTES = {
  stance: `data:image/svg+xml;utf8,${encodeURIComponent(`
    <svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 140'>
      <ellipse cx='52' cy='20' rx='9' ry='10' fill='black'/>
      <path d='M40 32 L65 32 L72 56 L78 80 L70 82 L62 60 L60 88 L66 130 L56 130 L52 96 L48 130 L38 130 L42 88 L40 60 L30 84 L22 80 L30 56 Z' fill='black'/>
    </svg>`)}`,
  guard: `data:image/svg+xml;utf8,${encodeURIComponent(`
    <svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 140'>
      <ellipse cx='50' cy='22' rx='10' ry='11' fill='black'/>
      <path d='M38 34 L62 34 L70 50 L66 64 L58 60 L56 58 L56 92 L62 130 L52 130 L50 100 L48 130 L38 130 L44 92 L44 58 L42 60 L34 64 L30 50 Z' fill='black'/>
    </svg>`)}`,
  robe: `data:image/svg+xml;utf8,${encodeURIComponent(`
    <svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 140'>
      <ellipse cx='50' cy='18' rx='9' ry='10' fill='black'/>
      <path d='M34 32 L66 32 L80 70 L82 130 L18 130 L20 70 Z' fill='black'/>
      <path d='M48 32 L52 32 L52 130 L48 130 Z' fill='black' opacity='0.3'/>
    </svg>`)}`,
  cape: `data:image/svg+xml;utf8,${encodeURIComponent(`
    <svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 140'>
      <ellipse cx='50' cy='20' rx='9' ry='10' fill='black'/>
      <path d='M30 36 L70 36 L86 90 L92 130 L62 130 L60 80 L56 90 L52 130 L48 130 L44 90 L40 80 L38 130 L8 130 L14 90 Z' fill='black'/>
    </svg>`)}`,
  fourarm: `data:image/svg+xml;utf8,${encodeURIComponent(`
    <svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 140'>
      <ellipse cx='50' cy='20' rx='10' ry='11' fill='black'/>
      <path d='M32 34 L68 34 L82 60 L78 76 L66 70 L62 56 L60 90 L66 130 L54 130 L52 100 L48 100 L46 130 L34 130 L40 90 L38 56 L34 70 L22 76 L18 60 Z' fill='black'/>
      <path d='M28 50 L18 80 L10 78 L20 44 Z M72 50 L82 80 L90 78 L80 44 Z' fill='black'/>
    </svg>`)}`
};

function Silhouette({ kind = "stance", era }) {
  const svg = SILHOUETTES[kind] || SILHOUETTES.stance;
  return (
    <div
      className={`silhouette silhouette-${era}`}
      style={{ "--silhouette-svg": `url("${svg}")` }} />);


}

// ─────────────────────────────────────────────────────────────
// BrandMark — the "OLD BLOOD // NEW BLOOD" seam logo
// ─────────────────────────────────────────────────────────────
function BrandMark({ size = 18, vertical = false }) {
  const base = { fontSize: size };
  if (vertical) {
    return (
      <div className="brand-mark" style={{ ...base, flexDirection: "column", alignItems: "stretch", gap: 0 }}>
        <div className="bm-old" style={{ textAlign: "center" }}>OLD BLOOD</div>
        <div className="bm-new" style={{ textAlign: "center", borderLeft: "1px solid var(--nb-line)", borderTop: 0 }}>NEW BLOOD</div>
      </div>);

  }
  return (
    <div className="brand-mark" style={base}>
      <span className="bm-old">OLD BLOOD</span>
      <span className="bm-slash">//</span>
      <span className="bm-new">NEW BLOOD</span>
    </div>);

}

// ─────────────────────────────────────────────────────────────
// EraCard — portrait-optimized trading card
// Structure: [top band] · [portrait slot + era overlay + chrome] · [name band]
// The portrait area is an <image-slot> so real photographs can be
// dragged in; the era treatment lives as a non-destructive overlay.
// ─────────────────────────────────────────────────────────────
function EraCard({ fighter, era, picked, onPick, slotIdPrefix = "demo", style, withSlot = true, nameBandMode = "full" }) {
  const isOld = era === "old";
  const tag = isOld ? fighter.oldTag : fighter.newTag;
  const slotId = `${slotIdPrefix}-${fighter.id}-${era}`;

  // top-band content
  const topBand = isOld ?
  <div className="fc-band-top" style={{
    background: "var(--ob-bone)",
    color: "var(--ob-ink)",
    borderBottom: "2px solid var(--ob-ink)"
  }}>
      <span className="ob-mono" style={{ fontSize: 12, letterSpacing: "0.05em", lineHeight: 1 }}>{tag}</span>
      <span className="ob-display" style={{ fontSize: 11, color: "var(--ob-blood)", lineHeight: 1 }}>1995</span>
    </div> :

  <div className="fc-band-top" style={{
    background: "var(--nb-ink)",
    color: "var(--nb-bone)",
    borderBottom: "1px solid var(--nb-line)"
  }}>
      <span className="nb-mono" style={{ fontSize: 9, letterSpacing: "0.18em", color: "var(--nb-mute)" }}>{tag}</span>
      <span className="nb-display nb-condensed" style={{ fontSize: 11, color: "var(--nb-red)", letterSpacing: "0.18em" }}>2026</span>
    </div>;


  // portrait slot (image-slot web component if available; static placeholder fallback)
  const slot = withSlot ?
  <image-slot
    id={slotId}
    shape="rect"
    fit="cover"
    placeholder={`${fighter.name.toUpperCase()} · DROP ${isOld ? "1995" : "2026"} PORTRAIT`}
    style={{ position: "absolute", inset: 0, display: "block", background: isOld ?
      "linear-gradient(180deg, oklch(0.32 0.16 25), oklch(0.18 0.10 25))" :
      "radial-gradient(ellipse at 50% 35%, oklch(0.22 0.02 260), oklch(0.06 0.005 270))"
    }} /> :


  <div className="fc-slot-fallback" style={{
    background: isOld ?
    "linear-gradient(180deg, oklch(0.32 0.16 25), oklch(0.18 0.10 25))" :
    "radial-gradient(ellipse at 50% 35%, oklch(0.22 0.02 260), oklch(0.06 0.005 270))"
  }} />;


  // era-treatment overlays
  const overlay =
  <div className={`fc-overlay ${isOld ? "fc-overlay-old" : "fc-overlay-new"}`}>
      {isOld && <div className="fc-tracking" />}
      {isOld && <div className="fc-chromabar" />}
      {!isOld && <div className="fc-grid-new" />}
      {!isOld && <div className="fc-lightning" />}
    </div>;


  // silhouette placeholder for the empty state (sits under the overlay,
  // hidden once the slot fills via :has — graceful fallback for older browsers
  // is just leaving the silhouette behind the photo, which still looks fine)
  const actor = isOld ? fighter.oldActor : fighter.newActor;
  const placeholder =
  <div className={`fc-slot-empty ${isOld ? "old" : ""}`}>
      <Silhouette kind={fighter.silhouette} era={era} />
      <div className="fc-id-tag">{actor ? actor.toUpperCase() : fighter.id.toUpperCase()} · {isOld ? "1995" : "MMXXVI"}</div>
    </div>;


  // picked-state stamp (over the portrait only)
  const pickedStamp = picked &&
  <div style={{
    position: "absolute", inset: 0, zIndex: 4,
    background: isOld ?
    "linear-gradient(180deg, oklch(0.55 0.25 340 / 0.35), oklch(0.50 0.22 25 / 0.45))" :
    "linear-gradient(180deg, transparent 30%, oklch(0.45 0.22 27 / 0.55) 100%)",
    display: "flex", alignItems: "center", justifyContent: "center",
    mixBlendMode: isOld ? "screen" : "normal",
    pointerEvents: "none"
  }}>
      <div className={isOld ? "ob-display ob-chromatic" : "nb-display nb-condensed"} style={{
      fontSize: isOld ? 24 : 28,
      color: isOld ? "var(--ob-bone)" : "var(--nb-bone)",
      letterSpacing: isOld ? "0.05em" : "0.12em",
      transform: isOld ? "rotate(-4deg)" : "none",
      border: isOld ? "3px solid var(--ob-bone)" : "1.5px solid var(--nb-bone)",
      padding: isOld ? "6px 14px 2px" : "8px 16px",
      background: isOld ? "transparent" : "rgba(0,0,0,0.35)",
      backdropFilter: isOld ? "none" : "blur(4px)"
    }}>PICKED</div>
    </div>;


  // bottom name band — content depends on nameBandMode
  // "full"  = character name + actor (standalone showcase)
  // "actor" = actor only (duel run; character name lives in the screen anchor)
  // "none"  = no band
  const showCharacter = nameBandMode === "full";
  const showActor = nameBandMode === "full" || nameBandMode === "actor";

  const nameBand = nameBandMode === "none" ? null : isOld ?
  <div className="fc-band-bot" style={{
    background: "var(--ob-bone)",
    color: "var(--ob-ink)",
    borderTop: "2px solid var(--ob-ink)",
    boxShadow: "inset 0 -3px 0 var(--ob-magenta), inset 0 -6px 0 var(--ob-ink)"
  }}>
      {showCharacter &&
    <div className="ob-display ob-chromatic" style={{
      fontSize: 16, lineHeight: 1, color: "var(--ob-ink)",
      textShadow: "1px 0 0 var(--ob-magenta), -1px 0 0 var(--ob-cyan)"
    }}>{fighter.name.toUpperCase()}</div>
    }
      {showActor && actor &&
    <div className="ob-mono" style={{
      fontSize: showCharacter ? 12 : 15,
      color: showCharacter ? "var(--ob-blood)" : "var(--ob-ink)",
      marginTop: showCharacter ? 3 : 0,
      letterSpacing: "0.02em", lineHeight: 1.05,
      fontWeight: showCharacter ? 400 : 700
    }}>
          {actor}
        </div>
    }
    </div> :

  <div className="fc-band-bot" style={{
    background: "var(--nb-ink)",
    color: "var(--nb-bone)",
    borderTop: "1px solid var(--nb-line)",
    boxShadow: "inset 0 -3px 0 var(--nb-red-2), inset 0 -5px 0 var(--nb-ink)"
  }}>
      {showCharacter &&
    <div className="nb-display nb-condensed" style={{ fontSize: 18, lineHeight: 1, letterSpacing: "0.01em" }}>
          {fighter.name.toUpperCase()}
        </div>
    }
      {showActor && actor &&
    <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: showCharacter ? 5 : 0 }}>
          <span style={{ display: "inline-block", width: 5, height: 5, background: "var(--nb-red)", flexShrink: 0 }} />
          <span className={showCharacter ? "nb-mono" : "nb-display nb-condensed"} style={{
        fontSize: showCharacter ? 10 : 16,
        color: showCharacter ? "var(--nb-mute)" : "var(--nb-bone)",
        letterSpacing: showCharacter ? "0.04em" : "0.01em",
        lineHeight: 1
      }}>
            {actor}
          </span>
        </div>
    }
    </div>;


  return (
    <button
      className="fighter-card"
      onClick={onPick}
      style={{ ...{
          background: isOld ? "var(--ob-bone)" : "var(--nb-ink)",
          border: isOld ? "2px solid var(--ob-ink)" : "2px solid var(--nb-line)",
          boxShadow: isOld ?
          picked ?
          "3px 3px 0 var(--ob-ink), 6px 6px 0 var(--ob-magenta)" :
          "2px 2px 0 var(--ob-ink)" :
          picked ?
          "0 14px 36px -8px oklch(0.55 0.24 27 / 0.7), 0 0 0 1px var(--nb-red)" :
          "0 10px 36px -8px oklch(0.40 0.22 27 / 0.35), 0 4px 14px -4px rgba(0,0,0,0.6)",
          padding: 0,
          cursor: onPick ? "pointer" : "default",
          textAlign: "left",
          color: "inherit",
          borderRadius: isOld ? "var(--card-r-old)" : "var(--card-r-new)",
          overflow: "hidden",
          transition: "box-shadow .15s, transform .15s",
          ...style
        }, borderRadius: "14px 14px 3px 3px" }}>
      
      {topBand}
      <div className="fc-portrait">
        {slot}
        {placeholder}
        {overlay}
        {pickedStamp}
      </div>
      {nameBand}
    </button>);

}

// ─────────────────────────────────────────────────────────────
// ProgressDots — minimal "step 3 of 9" affordance
// ─────────────────────────────────────────────────────────────
function ProgressDots({ total = 9, current = 0, picks = [] }) {
  return (
    <div style={{ display: "flex", gap: 3, alignItems: "center" }}>
      {Array.from({ length: total }, (_, i) => {
        const done = i < current;
        const active = i === current;
        const era = picks[i]; // 'old' | 'new' | undefined
        const fill = !done ? "rgba(255,255,255,0.18)" :
        era === "old" ? "var(--ob-magenta)" :
        era === "new" ? "var(--nb-red)" :
        "rgba(255,255,255,0.5)";
        return (
          <div key={i} style={{
            flex: 1,
            height: active ? 4 : 2,
            background: fill,
            transition: "all .2s",
            outline: active ? "1px solid var(--nb-bone)" : "none",
            outlineOffset: 1
          }} />);

      })}
    </div>);

}

// ─────────────────────────────────────────────────────────────
// MuteToggle — sound is off by default; this is the affordance
// ─────────────────────────────────────────────────────────────
function MuteToggle({ muted = true, onToggle }) {
  return (
    <button
      onClick={onToggle}
      style={{
        appearance: "none", border: 0, cursor: "pointer",
        background: "rgba(0,0,0,0.5)",
        color: "var(--nb-bone)",
        fontFamily: "var(--f-mono-new)",
        fontSize: 10, letterSpacing: "0.15em",
        padding: "8px 12px",
        display: "flex", alignItems: "center", gap: 8,
        border: "1px solid rgba(255,255,255,0.12)"
      }}
      aria-label={muted ? "Unmute audio" : "Mute audio"}>
      
      <span style={{
        display: "inline-block", width: 8, height: 8,
        background: muted ? "var(--nb-mute)" : "var(--nb-red)",
        animation: muted ? "none" : "pulse-red 1.6s infinite",
        borderRadius: 0
      }} />
      {muted ? "SOUND OFF · TAP TO ENABLE" : "SOUND ON"}
    </button>);

}

// ─────────────────────────────────────────────────────────────
// DisclaimerRibbon — persistent footer
// ─────────────────────────────────────────────────────────────
function DisclaimerRibbon() {
  return (
    <div className="disclaimer">
      UNOFFICIAL FAN PROJECT · NOT AFFILIATED WITH WARNER BROS., NEW LINE OR NETHERREALM · NO ADS, NO MONETIZATION
    </div>);

}

// ─────────────────────────────────────────────────────────────
// useTilt — cursor-following 3D tilt with reduced-motion bail
// ─────────────────────────────────────────────────────────────
function useTilt(intensity = 10) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;
    let raf = 0;
    const onMove = (e) => {
      const r = el.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - 0.5;
      const y = (e.clientY - r.top) / r.height - 0.5;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        el.style.setProperty("--ry", `${x * intensity}deg`);
        el.style.setProperty("--rx", `${-y * intensity}deg`);
      });
    };
    const onLeave = () => {
      el.style.setProperty("--ry", `0deg`);
      el.style.setProperty("--rx", `0deg`);
    };
    el.addEventListener("mousemove", onMove);
    el.addEventListener("mouseleave", onLeave);
    return () => {
      el.removeEventListener("mousemove", onMove);
      el.removeEventListener("mouseleave", onLeave);
      cancelAnimationFrame(raf);
    };
  }, [intensity]);
  return ref;
}

// ─────────────────────────────────────────────────────────────
// VS Seam — the "/" between the two era columns on a duel screen
// ─────────────────────────────────────────────────────────────
function VsSeam({ vertical = true }) {
  return (
    <div style={{
      display: "flex",
      flexDirection: vertical ? "column" : "row",
      alignItems: "center", justifyContent: "center",
      gap: 6,
      padding: vertical ? "12px 0" : "0 12px"
    }}>
      <div className="nb-display nb-condensed" style={{
        fontSize: 28, lineHeight: 1,
        color: "var(--nb-red)",
        textShadow: "0 0 18px oklch(0.55 0.24 27 / 0.6)"
      }}>VS</div>
      <div style={{
        flex: vertical ? "0 0 auto" : "1 1 auto",
        width: vertical ? 60 : 1,
        height: vertical ? 1 : 60,
        background: "linear-gradient(to right, transparent, var(--nb-red), transparent)"
      }} />
    </div>);

}

// expose to global scope for other Babel scripts
Object.assign(window, {
  FIGHTERS, SILHOUETTES, Silhouette, BrandMark, EraCard,
  ProgressDots, MuteToggle, DisclaimerRibbon, useTilt, VsSeam
});