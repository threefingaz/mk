// Audio infrastructure (Task 18).
//
// Full A-scope audio API. Sound files are NOT shipped with the initial build —
// they will be dropped into `public/audio/` later. Until then, every play call
// short-circuits silently per Q6 — no UI errors, no console output. The full
// slot manifest is documented in `public/audio/README.md` so devs onboarding
// new files don't need a runtime channel to discover the schema.
//
// Mirrors the "drop assets in later" pattern from the portrait system:
// missing file = silent absence, never a runtime failure.
//
// Singleton module — all state lives at module scope. There is only one
// AudioContext per browser tab. Tests reset state via `__resetAudioForTest()`.

// ---------------------------------------------------------------------------
// Sample manifest — declares every expected slot keyed by path. The file
// path is what gets fetched; the key is what playback functions look up.
// ---------------------------------------------------------------------------

const SAMPLE_PATHS = {
  'impacts/old-1': '/audio/impacts/old-1.webm',
  'impacts/old-2': '/audio/impacts/old-2.webm',
  'impacts/old-3': '/audio/impacts/old-3.webm',
  'impacts/new-1': '/audio/impacts/new-1.webm',
  'impacts/new-2': '/audio/impacts/new-2.webm',
  'impacts/new-3': '/audio/impacts/new-3.webm',
  'voice/old': '/audio/voice/old.webm',
  'voice/new': '/audio/voice/new.webm',
  'sting/verdict': '/audio/sting/verdict.webm',
  'bg/loop': '/audio/bg/loop.webm',
} as const;

type SampleKey = keyof typeof SAMPLE_PATHS;

// ---------------------------------------------------------------------------
// Module-level singleton state.
// ---------------------------------------------------------------------------

let ctx: AudioContext | null = null;
const samples: Map<SampleKey, AudioBuffer | null> = new Map();
const inflightLoads: Map<SampleKey, Promise<AudioBuffer | null>> = new Map();

let oldImpactIdx = 0;
let newImpactIdx = 0;

let bgLoopNode: AudioBufferSourceNode | null = null;
// Intent flag: bg loop is ambient (not gesture-driven), so callers declare
// intent up-front and the module starts/restarts the loop whenever the gating
// conditions (unlocked + !muted) become true. Without this, calling
// setBgLoop(true) before the first user gesture silently no-ops and the
// intent is lost — which is how the loop was failing to play in v1.
let wantsBgLoop = false;

let unlocked = false;
let unlockPromise: Promise<void> | null = null;

let muted = true; // mirrors the store's initial `muted: true`

// ---------------------------------------------------------------------------
// AudioContext acquisition.
// ---------------------------------------------------------------------------

type AudioContextCtor = typeof AudioContext;

function getAudioContextCtor(): AudioContextCtor | null {
  if (typeof globalThis === 'undefined') return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const g = globalThis as any;
  return (g.AudioContext ?? g.webkitAudioContext ?? null) as AudioContextCtor | null;
}

async function ensureContext(): Promise<void> {
  if (ctx) {
    // Browsers can put the context into a 'suspended' state until a user
    // gesture; we always try to resume defensively.
    if (ctx.state === 'suspended') {
      try {
        await ctx.resume();
      } catch {
        // Resume can fail on hostile browsers; not fatal — playback will
        // simply be silent until the next gesture.
      }
    }
    return;
  }
  const Ctor = getAudioContextCtor();
  if (!Ctor) return;
  try {
    ctx = new Ctor();
    if (ctx.state === 'suspended') {
      try {
        await ctx.resume();
      } catch {
        // Same as above.
      }
    }
  } catch {
    ctx = null;
  }
}

// ---------------------------------------------------------------------------
// Sample loading. Failure modes (404, fetch reject, decode error) all funnel
// to the same outcome: cache `null` for the slot, never throw. Per Q6 the
// fallback is truly silent — no console output. The full slot list is
// documented in `public/audio/README.md` so devs onboarding new files don't
// need a warning channel to discover the manifest.
// ---------------------------------------------------------------------------

async function tryLoad(path: string): Promise<AudioBuffer | null> {
  if (!ctx) return null;
  const res = await fetch(path);
  if (!res.ok) throw new Error('fetch !ok: ' + res.status);
  const ab = await res.arrayBuffer();
  return ctx.decodeAudioData(ab);
}

async function loadSample(key: SampleKey): Promise<AudioBuffer | null> {
  if (samples.has(key)) return samples.get(key) ?? null;
  const existing = inflightLoads.get(key);
  if (existing) return existing;

  const webmPath = SAMPLE_PATHS[key];
  const mp3Path = webmPath.replace(/\.webm$/, '.mp3');

  const load = (async (): Promise<AudioBuffer | null> => {
    try {
      if (!ctx) return null;
      let buf: AudioBuffer | null = null;
      try {
        buf = await tryLoad(webmPath);
      } catch {
        // webm missing or undecodable (Safari <14 has no Opus decode) — fall
        // back to the mp3 sibling. If that also fails the outer catch caches
        // null and stays silent per Q6.
        buf = await tryLoad(mp3Path);
      }
      samples.set(key, buf);
      return buf;
    } catch {
      samples.set(key, null);
      return null;
    } finally {
      inflightLoads.delete(key);
    }
  })();

  inflightLoads.set(key, load);
  return load;
}

// ---------------------------------------------------------------------------
// Public: unlock + muted.
// ---------------------------------------------------------------------------

/**
 * Called on first user gesture. Idempotent + coalesces concurrent calls into
 * a single in-flight promise so the AudioContext is only constructed once.
 *
 * Failure recovery: if ensureContext() can't produce a running context
 * (constructor throws, resume() rejects, or iOS Safari leaves state as
 * 'suspended' despite resume), `unlocked` stays false AND `unlockPromise` is
 * cleared so the *next* user gesture gets a fresh attempt. Without this the
 * module latches into a permanently-unlocked-but-silent state.
 */
export async function unlockAudio(): Promise<void> {
  if (unlocked) return;
  if (unlockPromise) return unlockPromise;

  unlockPromise = (async () => {
    try {
      await ensureContext();
      if (ctx && ctx.state === 'running') {
        unlocked = true;
        tryStartBgLoop();
      }
    } finally {
      unlockPromise = null;
    }
  })();
  return unlockPromise;
}

/** Update the muted flag. Wired from app/page.tsx watching the identity store. */
export function setMuted(next: boolean): void {
  muted = next;
  // Hard-stop bg loop the moment we mute.
  if (muted && bgLoopNode) {
    try {
      bgLoopNode.stop();
    } catch {
      // already stopped
    }
    try {
      bgLoopNode.disconnect();
    } catch {
      // ignore
    }
    bgLoopNode = null;
  }
  // On unmute, re-honor any standing bg-loop intent.
  if (!muted) tryStartBgLoop();
}

// ---------------------------------------------------------------------------
// Playback primitives.
// ---------------------------------------------------------------------------

function playBuffer(buf: AudioBuffer | null, loop = false): AudioBufferSourceNode | null {
  if (!buf || !ctx) return null;
  try {
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = loop;
    src.connect(ctx.destination);
    src.start();
    return src;
  } catch {
    return null;
  }
}

/**
 * SSR-safe `prefers-reduced-motion: reduce` check. Mirrors the pattern in
 * `hooks/useTilt.ts` — CLAUDE.md lists this file as a load-bearing
 * suppression point for reduced-motion users.
 */
function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Common guard for the one-shot play functions. Returns true when the caller
 * should proceed to actually schedule sound. Gates on reduced-motion AND
 * `ctx.state === 'running'` so a suspended-after-unlock context (iOS Safari
 * edge case) doesn't get sources scheduled into it.
 */
function canPlay(): boolean {
  if (prefersReducedMotion()) return false;
  return unlocked && !muted && ctx !== null && ctx.state === 'running';
}

async function playSlot(key: SampleKey): Promise<void> {
  if (!canPlay()) return;
  const buf = await loadSample(key);
  if (!canPlay()) return; // muted in the meantime
  playBuffer(buf, false);
}

// ---------------------------------------------------------------------------
// Public play functions.
// ---------------------------------------------------------------------------

export function playOldImpact(): void {
  const variant = (oldImpactIdx % 3) + 1;
  oldImpactIdx = (oldImpactIdx + 1) % 3;
  void playSlot(('impacts/old-' + variant) as SampleKey);
}

export function playNewImpact(): void {
  const variant = (newImpactIdx % 3) + 1;
  newImpactIdx = (newImpactIdx + 1) % 3;
  void playSlot(('impacts/new-' + variant) as SampleKey);
}

export function playOldVoice(): void {
  void playSlot('voice/old');
}

export function playNewVoice(): void {
  void playSlot('voice/new');
}

export function playVerdictSting(): void {
  void playSlot('sting/verdict');
}

/**
 * Declare bg-loop intent. on=true means "play the loop whenever conditions
 * allow"; the module will start it now if unlocked+unmuted, and retry on the
 * next unlock/unmute transition otherwise. on=false stops the loop and clears
 * the intent. Idempotent — calling setBgLoop(true) while already playing is
 * a no-op.
 */
export function setBgLoop(on: boolean): void {
  wantsBgLoop = on;
  if (!on) {
    if (bgLoopNode) {
      try {
        bgLoopNode.stop();
      } catch {
        // ignore
      }
      try {
        bgLoopNode.disconnect();
      } catch {
        // ignore
      }
      bgLoopNode = null;
    }
    return;
  }
  tryStartBgLoop();
}

function tryStartBgLoop(): void {
  if (!wantsBgLoop) return;
  if (!canPlay() || bgLoopNode) return;
  void (async () => {
    const buf = await loadSample('bg/loop');
    if (!wantsBgLoop || !canPlay() || bgLoopNode) return;
    const node = playBuffer(buf, true);
    if (node) {
      bgLoopNode = node;
    }
  })();
}

// ---------------------------------------------------------------------------
// Test-only reset hook.
// ---------------------------------------------------------------------------

export function __resetAudioForTest(): void {
  ctx = null;
  samples.clear();
  inflightLoads.clear();
  oldImpactIdx = 0;
  newImpactIdx = 0;
  if (bgLoopNode) {
    try {
      bgLoopNode.stop();
    } catch {
      // ignore
    }
    bgLoopNode = null;
  }
  wantsBgLoop = false;
  unlocked = false;
  unlockPromise = null;
  muted = true;
}
