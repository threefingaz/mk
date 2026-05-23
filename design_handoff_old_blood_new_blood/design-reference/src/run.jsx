// src/run.jsx — the live playable 9-duel run
// State machine: landing → 9 duels → verdict → share → (loop)

function PlayableRun({ scoreboardUnlocked = false, archetypeSet = "A" }) {
  const [phase, setPhase] = useState("landing"); // landing | duel | verdict | share
  const [step, setStep] = useState(0);           // 0..8 during duel
  const [picks, setPicks] = useState([]);        // ['old'|'new'][]
  const [duelState, setDuelState] = useState("idle"); // idle | pickedOld | pickedNew
  const [muted, setMuted] = useState(true);

  // Per-fighter mock crowd majorities (deterministic so the demo is stable)
  const crowdBy = useMemo(() => FIGHTERS.map((f, i) => ({
    fighter: f.id, old: 30 + ((i * 13) % 50),
  })), []);

  const start = () => { setPhase("duel"); setStep(0); setPicks([]); setDuelState("idle"); };
  const pick = (era) => {
    setDuelState(era === "old" ? "pickedOld" : "pickedNew");
  };
  const next = () => {
    const newPicks = [...picks, duelState === "pickedOld" ? "old" : "new"];
    setPicks(newPicks);
    if (step >= 8) {
      setPhase("verdict");
    } else {
      setStep(step + 1);
      setDuelState("idle");
    }
  };

  const cur = FIGHTERS[step];
  const crowd = crowdBy[step];

  // Compute result for verdict cards
  const result = useMemo(() => {
    const oldCount = picks.filter(p => p === "old").length;
    return {
      oldPicks: oldCount,
      newPicks: 9 - oldCount,
      picks: picks.map((choice, i) => ({
        fighter: FIGHTERS[i].id,
        choice,
        majority: crowdBy[i].old > 50 ? "old" : "new",
      })),
      defied: picks.filter((c, i) => {
        const maj = crowdBy[i].old > 50 ? "old" : "new";
        return c !== maj;
      }).length,
      date: "2026.05.23",
      runId: "OB-NB-LIVE",
    };
  }, [picks]);

  // ── render
  if (phase === "landing") {
    return (
      <div onClick={(e)=>{
        const t = e.target;
        if (t.closest && t.closest(".btn-new")) start();
      }}>
        <LandingScreen unlocked={scoreboardUnlocked} playsUntil={12}/>
      </div>
    );
  }

  if (phase === "duel") {
    const onClick = (e) => {
      const t = e.target;
      if (duelState === "idle") {
        // Tap a card
        const card = t.closest && t.closest(".fighter-card");
        if (card) {
          // index 0 = old (left), index 1 = new (right)
          const parent = card.parentElement.parentElement.parentElement;
          const cards = parent.querySelectorAll(".fighter-card");
          const idx = Array.from(cards).indexOf(card);
          pick(idx === 0 ? "old" : "new");
        }
      } else {
        if (t.closest && t.closest(".btn-new")) next();
      }
    };
    return (
      <div onClick={onClick}>
        <DuelScreen
          fighter={cur}
          step={step+1}
          total={9}
          picks={picks}
          state={duelState}
          showCrowd={scoreboardUnlocked && duelState !== "idle"}
          crowd={{ old: crowd.old, new: 100 - crowd.old }}
          slotIdPrefix="run"
        />
      </div>
    );
  }

  if (phase === "verdict") {
    const onClick = (e) => {
      const t = e.target.closest && e.target.closest(".btn-new");
      if (!t) return;
      const txt = t.textContent || "";
      if (txt.includes("SHARE")) setPhase("share");
      else if (txt.includes("RUN AGAIN")) setPhase("landing");
    };
    return (
      <div onClick={onClick}>
        <VerdictRevealScreen data={scoreboardUnlocked ? "unlocked" : "n1"} archetypeSet={archetypeSet}/>
      </div>
    );
  }

  if (phase === "share") {
    const onClick = (e) => {
      const back = e.target.closest && e.target.textContent === "← BACK";
      if (back) { setPhase("verdict"); return; }
      const btn = e.target.closest && e.target.closest(".btn-new");
      if (btn && btn.textContent.includes("SHARE")) {
        // simulate share — flash
        return;
      }
      const link = e.target.classList && e.target.classList.contains("nb-mono") && e.target.textContent.includes("RUN AGAIN");
      if (link) setPhase("landing");
    };
    return (
      <div onClick={onClick}>
        <ShareSheetScreen data={scoreboardUnlocked ? "unlocked" : "n1"} archetypeSet={archetypeSet}/>
      </div>
    );
  }

  return null;
}

window.PlayableRun = PlayableRun;
