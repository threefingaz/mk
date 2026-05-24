// Phase 2 e2e — backend resilience + pre/post-unlock branches (Task 26).
//
// All four specs run against `next dev` with Playwright route interception
// mocking the three API endpoints. The backend (Upstash KV / in-memory mock)
// is bypassed entirely so we can assert UI behavior in deterministic states:
//
//   1. Pre-unlock — /api/results returns unlocked:false → no crowd bar in
//      duels, n1 verdict (no CONTRARIAN stat).
//   2. Post-unlock — /api/results returns unlocked:true with deterministic
//      stats → crowd bar visible after each pick, unlocked verdict with
//      CONTRARIAN count.
//   3. Resilience — /api/results returns 500 → resilience client synthesizes
//      a pre-unlock fallback, Landing still renders, FIGHT still proceeds.
//   4. Idempotency — counts /api/complete calls. Asserts the client fires
//      exactly once per run (server-side dedupe is separately unit-tested).
//
// State isolation: each test clears sessionStorage + localStorage at start
// and reloads so the Zustand persist middleware rehydrates to defaults.
// Without this, a previous run's identity slice (hasVoted=true) would route
// to ReturningVisitor instead of Landing.

import { test, expect, type Page } from '@playwright/test';
import type { FighterId } from '../lib/fighters';

// Deterministic post-unlock stats — every fighter has a defined old/new count
// so the resilience client + Duel screen always have data to render the
// crowd bar after each pick. Numbers are arbitrary but stable.
const UNLOCKED_STATS: Record<FighterId, { old: number; new: number; total: number }> = {
  raiden:       { old: 40, new: 60, total: 100 },
  liukang:      { old: 55, new: 45, total: 100 },
  johnnycage:   { old: 30, new: 70, total: 100 },
  sonya:        { old: 50, new: 50, total: 100 },
  kitana:       { old: 65, new: 35, total: 100 },
  shangtsung:   { old: 48, new: 52, total: 100 },
  kano:         { old: 70, new: 30, total: 100 },
  scorpion:     { old: 25, new: 75, total: 100 },
  subzero:      { old: 60, new: 40, total: 100 },
};

/** Common setup — navigate, clear storage, reload so the persist middleware
 *  rehydrates to defaults (otherwise a previous run leaks across tests). */
async function navigateClean(page: Page): Promise<void> {
  await page.goto('/');
  await page.evaluate(() => {
    sessionStorage.clear();
    localStorage.clear();
  });
  await page.reload();
}

/** Drive a 9-duel run with alternating old/new picks (5 olds + 4 news).
 *  Optional per-step assertion runs after each pick, before NEXT FIGHTER. */
async function runNineDuels(
  page: Page,
  perStep?: (page: Page, step: number) => Promise<void>,
): Promise<void> {
  for (let i = 0; i < 9; i++) {
    const oldCard = page.locator('.fighter-card-old');
    const newCard = page.locator('.fighter-card-new');
    await expect(oldCard.first()).toBeVisible();
    await expect(newCard.first()).toBeVisible();

    const target = i % 2 === 0 ? oldCard : newCard;
    await target.first().click();

    if (perStep) {
      await perStep(page, i);
    }

    const nextButton = page.getByRole('button', { name: /NEXT FIGHTER/i });
    await expect(nextButton).toBeVisible();
    await nextButton.click();
  }
}

// ---------------------------------------------------------------------------
// Test 1 — Pre-unlock: no crowd bars, n1 verdict.
// ---------------------------------------------------------------------------

test('pre-unlock: no crowd bars, verdict hides CONTRARIAN', async ({ page }) => {
  // Intercept /api/results BEFORE the page loads — the resilience client
  // calls fetchResults() on mount of app/page.tsx.
  await page.route('**/api/results', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ unlocked: false, plays: 5, threshold: 30 }),
    });
  });
  // Silence /api/vote + /api/complete so they don't hit the dev backend.
  await page.route('**/api/vote', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true, unlocked: false }),
    });
  });
  await page.route('**/api/complete', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true, unlocked: false, justUnlocked: false, plays: 6 }),
    });
  });

  await navigateClean(page);

  const fightButton = page.getByRole('button', { name: /FIGHT/i });
  await expect(fightButton).toBeVisible();
  await fightButton.click();

  // After each pick, assert NO crowd bar exists in the duel screen. The
  // OldNewBar carries data-testid="old-new-bar"; the Duel screen wraps it in
  // data-testid="duel-crowd-bar". Either selector confirms absence.
  await runNineDuels(page, async (p) => {
    const crowdBar = p.getByTestId('duel-crowd-bar');
    await expect(crowdBar).toHaveCount(0);
  });

  // Verdict screen — assert n1 mode: stats lockup shows "5/9 OLD · 4/9 NEW"
  // but does NOT include CONTRARIAN (which only renders when defied !== null,
  // i.e. when scoreboardUnlocked).
  const verdictScreen = page.getByTestId('verdict-screen');
  await expect(verdictScreen).toBeVisible();

  const stats = page.getByTestId('verdict-stats');
  await expect(stats).toContainText('5/9 OLD');
  await expect(stats).toContainText('4/9 NEW');
  await expect(stats).not.toContainText('CONTRARIAN');

  // Defense-in-depth: verdict-card data-mode attribute.
  const card = page.getByTestId('verdict-card');
  await expect(card).toHaveAttribute('data-mode', 'n1');
});

// ---------------------------------------------------------------------------
// Test 2 — Post-unlock: crowd bars animate, verdict shows CONTRARIAN.
// ---------------------------------------------------------------------------

test('post-unlock: crowd bars visible per pick, verdict shows CONTRARIAN', async ({ page }) => {
  await page.route('**/api/results', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        unlocked: true,
        plays: 99,
        threshold: 30,
        stats: UNLOCKED_STATS,
      }),
    });
  });
  await page.route('**/api/vote', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ok: true,
        unlocked: true,
        counts: { old: 50, new: 50 },
      }),
    });
  });
  await page.route('**/api/complete', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ok: true,
        unlocked: true,
        justUnlocked: false,
        plays: 100,
      }),
    });
  });

  await navigateClean(page);

  const fightButton = page.getByRole('button', { name: /FIGHT/i });
  await expect(fightButton).toBeVisible();
  await fightButton.click();

  // After each pick, assert the OldNewBar is visible. The bar mounts only
  // when scoreboardUnlocked && picked && crowdStats[fighter.id] is present,
  // which is true for every fighter under UNLOCKED_STATS.
  await runNineDuels(page, async (p) => {
    const crowdBar = p.getByTestId('duel-crowd-bar');
    await expect(crowdBar).toBeVisible();
  });

  // Verdict screen — assert unlocked mode: stats lockup must include
  // "X/9 CONTRARIAN" where X is the live-derived defied count. We don't
  // assert the exact number (it depends on majority math per fighter) — just
  // that the CONTRARIAN token is present.
  const verdictScreen = page.getByTestId('verdict-screen');
  await expect(verdictScreen).toBeVisible();

  const stats = page.getByTestId('verdict-stats');
  await expect(stats).toContainText('5/9 OLD');
  await expect(stats).toContainText('4/9 NEW');
  await expect(stats).toContainText(/\d\/9 CONTRARIAN/);

  // Defense-in-depth: verdict-card data-mode attribute should be 'unlocked'.
  const card = page.getByTestId('verdict-card');
  await expect(card).toHaveAttribute('data-mode', 'unlocked');
});

// ---------------------------------------------------------------------------
// Test 3 — Resilience: /api/results returns 500.
// ---------------------------------------------------------------------------

test('resilience: /api/results 500 falls back to pre-unlock UI', async ({ page }) => {
  await page.route('**/api/results', async (route) => {
    await route.fulfill({
      status: 500,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'Internal Server Error' }),
    });
  });
  // Keep /api/vote + /api/complete healthy so the run still proceeds — the
  // assertion here is specifically about /api/results failure handling.
  await page.route('**/api/vote', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true, unlocked: false }),
    });
  });
  await page.route('**/api/complete', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true, unlocked: false, justUnlocked: false, plays: 1 }),
    });
  });

  await navigateClean(page);

  // Landing must render in pre-unlock state — the synthesized fallback in
  // lib/api-client.ts returns { unlocked: false, plays: 0, threshold: 30 },
  // so the countdown chip shows "PLAYS UNTIL SCOREBOARD UNLOCKS · 30" and
  // the FIGHT CTA is clickable.
  const fightButton = page.getByRole('button', { name: /FIGHT/i });
  await expect(fightButton).toBeVisible();
  await expect(fightButton).toBeEnabled();

  // Pre-unlock chip should be present (sanity check the fallback flowed
  // through to the Landing prop). Substring match avoids whitespace fragility.
  await expect(page.getByText(/PLAYS UNTIL SCOREBOARD UNLOCKS/i)).toBeVisible();

  // Confirm the run can still proceed: tap FIGHT and reach the first duel.
  await fightButton.click();
  const oldCard = page.locator('.fighter-card-old');
  const newCard = page.locator('.fighter-card-new');
  await expect(oldCard.first()).toBeVisible();
  await expect(newCard.first()).toBeVisible();
});

// ---------------------------------------------------------------------------
// Test 4 — Idempotency: client fires /api/complete exactly once.
// ---------------------------------------------------------------------------

test('idempotency: /api/complete fires exactly once per run', async ({ page }) => {
  // Track calls per runId. The body is JSON-encoded { runId } per the
  // resilience client contract (lib/api-client.ts).
  const completeCalls: string[] = [];

  await page.route('**/api/results', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ unlocked: false, plays: 5, threshold: 30 }),
    });
  });
  await page.route('**/api/vote', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true, unlocked: false }),
    });
  });
  await page.route('**/api/complete', async (route) => {
    const postData = route.request().postData() ?? '{}';
    try {
      const parsed = JSON.parse(postData) as { runId?: string };
      if (parsed.runId) completeCalls.push(parsed.runId);
    } catch {
      // Body should always parse — but fall back to the raw string for
      // diagnostic visibility if it doesn't.
      completeCalls.push(postData);
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true, unlocked: false, justUnlocked: false, plays: 6 }),
    });
  });

  await navigateClean(page);

  const fightButton = page.getByRole('button', { name: /FIGHT/i });
  await expect(fightButton).toBeVisible();
  await fightButton.click();

  await runNineDuels(page);

  // Wait for the verdict screen — submitComplete fires on Verdict mount.
  const verdictScreen = page.getByTestId('verdict-screen');
  await expect(verdictScreen).toBeVisible();

  // Give the client a beat to fire /api/complete after Verdict mount.
  // The completion effect is non-awaited in the component; this expect.poll
  // is the deterministic way to wait for the network request to land.
  await expect.poll(() => completeCalls.length, { timeout: 5000 }).toBe(1);

  // Assert the single call carried a single, non-empty runId. The exact uuid
  // is random per run; we just verify it's a stable string.
  expect(completeCalls).toHaveLength(1);
  expect(completeCalls[0]).toBeTruthy();
  expect(typeof completeCalls[0]).toBe('string');
});
