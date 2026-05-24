// Audio module unit tests (Task 18).
//
// jsdom doesn't ship a real Web Audio implementation, so we stub the bare
// minimum surface used by `lib/audio.ts`. The tests cover:
//
//   1. Variant rotation — playOldImpact() cycles 1→2→3→1; same for new.
//   2. Silent fallback  — fetch rejection caches null + warns once, no throw.
//   3. Muted short-circuit — setMuted(true) suppresses all source creation.
//   4. Unlock fires once — concurrent unlockAudio() calls coalesce.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  __resetAudioForTest,
  playNewImpact,
  playOldImpact,
  setBgLoop,
  setMuted,
  unlockAudio,
} from './audio';

// ---------------------------------------------------------------------------
// Stub AudioContext + helpers.
// ---------------------------------------------------------------------------

let ctxConstructorCount = 0;
const createdSources: Array<{ start: ReturnType<typeof vi.fn>; stop: ReturnType<typeof vi.fn> }> =
  [];

class StubAudioBufferSourceNode {
  buffer: unknown = null;
  loop = false;
  start = vi.fn();
  stop = vi.fn();
  connect = vi.fn();
  disconnect = vi.fn();
  constructor() {
    createdSources.push({ start: this.start, stop: this.stop });
  }
}

class StubAudioContext {
  state: 'suspended' | 'running' = 'suspended';
  destination = {};
  constructor() {
    ctxConstructorCount += 1;
  }
  resume = vi.fn().mockImplementation(async () => {
    this.state = 'running';
  });
  decodeAudioData = vi.fn().mockImplementation(async () => {
    // Return a stand-in AudioBuffer-shaped object. Identity is all that matters.
    return { __audioBuffer: true } as unknown as AudioBuffer;
  });
  createBufferSource = vi.fn().mockImplementation(() => new StubAudioBufferSourceNode());
}

/**
 * Install the stub AudioContext on globalThis. Returns the original (if any)
 * so the test teardown can restore it.
 */
function installStubAudioContext() {
  const g = globalThis as unknown as { AudioContext?: unknown };
  const original = g.AudioContext;
  g.AudioContext = StubAudioContext as unknown as typeof AudioContext;
  return () => {
    g.AudioContext = original;
  };
}

/** Build a Response-like object compatible with `await res.arrayBuffer()`. */
function okResponse(): Response {
  // Minimal duck-type — audio.ts only reads `ok` and calls `arrayBuffer()`.
  return {
    ok: true,
    status: 200,
    arrayBuffer: async () => new ArrayBuffer(8),
  } as unknown as Response;
}

// ---------------------------------------------------------------------------
// Lifecycle.
// ---------------------------------------------------------------------------

let restoreAudioContext: () => void = () => {};
let fetchSpy: ReturnType<typeof vi.fn>;
let warnSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  __resetAudioForTest();
  ctxConstructorCount = 0;
  createdSources.length = 0;
  restoreAudioContext = installStubAudioContext();

  fetchSpy = vi.fn().mockImplementation(async () => okResponse());
  (globalThis as unknown as { fetch: typeof fetch }).fetch = fetchSpy as unknown as typeof fetch;

  warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  restoreAudioContext();
  warnSpy.mockRestore();
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Tests.
// ---------------------------------------------------------------------------

describe('audio module', () => {
  describe('variant rotation', () => {
    it('playOldImpact cycles old-1 → old-2 → old-3 → old-1 across 4 calls', async () => {
      await unlockAudio();
      setMuted(false);

      playOldImpact();
      playOldImpact();
      playOldImpact();
      playOldImpact();

      // Let the queued microtasks for fetch + decode flush.
      await new Promise((resolve) => setTimeout(resolve, 0));
      await new Promise((resolve) => setTimeout(resolve, 0));

      const fetchedPaths = fetchSpy.mock.calls.map((c) => String(c[0]));
      // Strict order assertion on the first 3 fetches (cache hit on the 4th).
      expect(fetchedPaths.slice(0, 3)).toEqual([
        '/audio/impacts/old-1.webm',
        '/audio/impacts/old-2.webm',
        '/audio/impacts/old-3.webm',
      ]);
      // old-1 only fetched once, despite being visited twice.
      const old1Hits = fetchedPaths.filter((p) => p === '/audio/impacts/old-1.webm').length;
      expect(old1Hits).toBe(1);
    });

    it('playNewImpact cycles new-1 → new-2 → new-3 → new-1', async () => {
      await unlockAudio();
      setMuted(false);

      playNewImpact();
      playNewImpact();
      playNewImpact();
      playNewImpact();

      await new Promise((resolve) => setTimeout(resolve, 0));
      await new Promise((resolve) => setTimeout(resolve, 0));

      const fetchedPaths = fetchSpy.mock.calls.map((c) => String(c[0]));
      expect(fetchedPaths.slice(0, 3)).toEqual([
        '/audio/impacts/new-1.webm',
        '/audio/impacts/new-2.webm',
        '/audio/impacts/new-3.webm',
      ]);
      const new1Hits = fetchedPaths.filter((p) => p === '/audio/impacts/new-1.webm').length;
      expect(new1Hits).toBe(1);
    });
  });

  describe('silent fallback on missing file', () => {
    it('fetch rejection caches null + stays silent (no warn, no throw)', async () => {
      fetchSpy.mockReset();
      fetchSpy.mockImplementation(async () => {
        throw new Error('network down');
      });

      await unlockAudio();
      setMuted(false);

      expect(() => playOldImpact()).not.toThrow();
      await new Promise((resolve) => setTimeout(resolve, 0));
      await new Promise((resolve) => setTimeout(resolve, 0));

      // Silent fallback per Q6 — no console output, even once.
      expect(warnSpy).not.toHaveBeenCalled();

      // No source nodes should have been created (no playable buffer).
      expect(createdSources).toHaveLength(0);
    });

    it('webm 404 falls back to mp3 sibling', async () => {
      fetchSpy.mockReset();
      fetchSpy.mockImplementation(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.endsWith('.webm')) {
          return { ok: false, status: 404, arrayBuffer: async () => new ArrayBuffer(0) } as unknown as Response;
        }
        return okResponse();
      });

      await unlockAudio();
      setMuted(false);

      playOldImpact();
      await new Promise((resolve) => setTimeout(resolve, 0));
      await new Promise((resolve) => setTimeout(resolve, 0));

      const fetchedPaths = fetchSpy.mock.calls.map((c) => String(c[0]));
      expect(fetchedPaths).toContain('/audio/impacts/old-1.webm');
      expect(fetchedPaths).toContain('/audio/impacts/old-1.mp3');
      // The mp3 succeeded, so a source node should have been created.
      expect(createdSources).toHaveLength(1);
    });

    it('404 response is treated as missing (silent — no warn, no source)', async () => {
      fetchSpy.mockReset();
      fetchSpy.mockImplementation(
        async () =>
          ({
            ok: false,
            status: 404,
            arrayBuffer: async () => new ArrayBuffer(0),
          }) as unknown as Response,
      );

      await unlockAudio();
      setMuted(false);

      expect(() => playOldImpact()).not.toThrow();
      await new Promise((resolve) => setTimeout(resolve, 0));
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(warnSpy).not.toHaveBeenCalled();
      expect(createdSources).toHaveLength(0);
    });
  });

  describe('muted short-circuit', () => {
    it('does not create a source node when muted=true', async () => {
      await unlockAudio();
      setMuted(true);

      playOldImpact();
      await new Promise((resolve) => setTimeout(resolve, 0));
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(createdSources).toHaveLength(0);
      // No fetch attempted either — muted short-circuits before loadSample.
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('setMuted(true) stops an active bg loop', async () => {
      await unlockAudio();
      setMuted(false);

      setBgLoop(true);
      // Flush load + start of the bg source.
      await new Promise((resolve) => setTimeout(resolve, 0));
      await new Promise((resolve) => setTimeout(resolve, 0));

      // One source — the bg loop — should have started.
      expect(createdSources.length).toBeGreaterThanOrEqual(1);
      const bgSource = createdSources[createdSources.length - 1];
      expect(bgSource.start).toHaveBeenCalled();

      setMuted(true);
      expect(bgSource.stop).toHaveBeenCalled();
    });
  });

  describe('setBgLoop', () => {
    it('setBgLoop(false) directly stops an active bg loop', async () => {
      await unlockAudio();
      setMuted(false);

      setBgLoop(true);
      await new Promise((resolve) => setTimeout(resolve, 0));
      await new Promise((resolve) => setTimeout(resolve, 0));

      const bgSource = createdSources[createdSources.length - 1];
      expect(bgSource.start).toHaveBeenCalled();

      setBgLoop(false);
      expect(bgSource.stop).toHaveBeenCalled();
    });

    it('setBgLoop(true) before unlock defers start until unlockAudio resolves', async () => {
      setMuted(false);
      setBgLoop(true);
      // No unlock yet — nothing should have fetched or sourced.
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(fetchSpy).not.toHaveBeenCalled();
      expect(createdSources).toHaveLength(0);

      await unlockAudio();
      await new Promise((resolve) => setTimeout(resolve, 0));
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(createdSources.length).toBeGreaterThanOrEqual(1);
      expect(createdSources[createdSources.length - 1].start).toHaveBeenCalled();
    });

    it('setBgLoop(true) then mute→unmute restarts the loop without re-calling setBgLoop', async () => {
      await unlockAudio();
      setMuted(false);
      setBgLoop(true);
      await new Promise((resolve) => setTimeout(resolve, 0));
      await new Promise((resolve) => setTimeout(resolve, 0));
      const firstCount = createdSources.length;
      expect(firstCount).toBeGreaterThanOrEqual(1);

      setMuted(true);
      // Mute should have stopped the loop.
      expect(createdSources[firstCount - 1].stop).toHaveBeenCalled();

      setMuted(false);
      await new Promise((resolve) => setTimeout(resolve, 0));
      await new Promise((resolve) => setTimeout(resolve, 0));
      // Unmute should auto-restart from standing intent.
      expect(createdSources.length).toBeGreaterThan(firstCount);
    });

    it('setBgLoop(true) while already playing is a no-op (does not create a second source)', async () => {
      await unlockAudio();
      setMuted(false);

      setBgLoop(true);
      await new Promise((resolve) => setTimeout(resolve, 0));
      await new Promise((resolve) => setTimeout(resolve, 0));
      const firstCount = createdSources.length;

      // Re-calling setBgLoop(true) while already playing must NOT spin up a
      // second source node.
      setBgLoop(true);
      await new Promise((resolve) => setTimeout(resolve, 0));
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(createdSources.length).toBe(firstCount);
    });
  });

  describe('AudioContext unlock', () => {
    it('constructs the AudioContext exactly once across concurrent calls', async () => {
      // Three concurrent unlocks; they should coalesce on a single
      // construction.
      await Promise.all([unlockAudio(), unlockAudio(), unlockAudio()]);
      expect(ctxConstructorCount).toBe(1);
    });

    it('subsequent unlock calls after the first remain a no-op', async () => {
      await unlockAudio();
      await unlockAudio();
      await unlockAudio();
      expect(ctxConstructorCount).toBe(1);
    });

    it('play calls before unlock are silent (no fetch, no source)', async () => {
      // No unlockAudio() before this — playback should be inert.
      setMuted(false);
      playOldImpact();
      await new Promise((resolve) => setTimeout(resolve, 0));
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(fetchSpy).not.toHaveBeenCalled();
      expect(createdSources).toHaveLength(0);
    });

    it('does not latch unlocked when resume() keeps failing — next gesture retries', async () => {
      // Replace the global stub with one whose resume() rejects, leaving the
      // context in 'suspended'. This simulates the iOS Safari autoplay edge
      // case the unlock-state hardening is meant to recover from.
      restoreAudioContext();
      let resumeAttempts = 0;
      class StuckSuspendedContext {
        state: 'suspended' | 'running' = 'suspended';
        destination = {};
        constructor() {
          ctxConstructorCount += 1;
        }
        resume = vi.fn().mockImplementation(async () => {
          resumeAttempts += 1;
          throw new Error('resume failed');
        });
        decodeAudioData = vi.fn().mockImplementation(async () => ({}) as unknown as AudioBuffer);
        createBufferSource = vi.fn().mockImplementation(() => new StubAudioBufferSourceNode());
      }
      (globalThis as unknown as { AudioContext: unknown }).AudioContext =
        StuckSuspendedContext as unknown as typeof AudioContext;
      restoreAudioContext = () => {
        (globalThis as unknown as { AudioContext?: unknown }).AudioContext = undefined;
      };

      await unlockAudio();
      // canPlay should reject — no source should be schedulable.
      setMuted(false);
      playOldImpact();
      await new Promise((resolve) => setTimeout(resolve, 0));
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(createdSources).toHaveLength(0);

      // Second gesture retries resume — confirms unlock didn't latch.
      await unlockAudio();
      expect(resumeAttempts).toBeGreaterThanOrEqual(2);
    });
  });

  describe('prefers-reduced-motion suppression', () => {
    let originalMatchMedia: typeof window.matchMedia | undefined;

    beforeEach(() => {
      originalMatchMedia = window.matchMedia;
      window.matchMedia = ((query: string) =>
        ({
          matches: query.includes('prefers-reduced-motion'),
          media: query,
          addEventListener: () => {},
          removeEventListener: () => {},
        }) as unknown as MediaQueryList) as typeof window.matchMedia;
    });

    afterEach(() => {
      if (originalMatchMedia) window.matchMedia = originalMatchMedia;
      else delete (window as unknown as { matchMedia?: unknown }).matchMedia;
    });

    it('suppresses one-shot playback even when unlocked + unmuted', async () => {
      await unlockAudio();
      setMuted(false);

      playOldImpact();
      await new Promise((resolve) => setTimeout(resolve, 0));
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(fetchSpy).not.toHaveBeenCalled();
      expect(createdSources).toHaveLength(0);
    });

    it('suppresses the bg loop even with standing intent', async () => {
      await unlockAudio();
      setMuted(false);
      setBgLoop(true);

      await new Promise((resolve) => setTimeout(resolve, 0));
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(createdSources).toHaveLength(0);
    });
  });
});
