// Phase 1 e2e smoke (Task 19).
//
// Drives the full happy-path flow:
//   landing → FIGHT → 9 duels (alternating old/new picks) → verdict screen.
//
// Deterministic-archetype trick: alternating picks starting with 'old' across
// 9 duels yields 5 olds + 4 news → "Switch-Hitter" archetype (per
// lib/archetype.ts). The fighter shuffle order doesn't matter because the
// archetype is keyed off `oldPicks`, not which fighter the pick belongs to.
//
// State-isolation contract: this test clears sessionStorage + localStorage on
// load and reloads so the Zustand persist middleware rehydrates to defaults.
// Without this, a previous run's identity slice (hasVoted=true) would route to
// ReturningVisitor instead of Landing.

import { test, expect } from '@playwright/test';

test('completes a 9-duel run and lands on verdict', async ({ page }) => {
  // 1. Navigate, clear storage, reload to ensure the Zustand persist middleware
  //    re-reads empty storage and hydrates to the default 'landing' phase.
  await page.goto('/');
  await page.evaluate(() => {
    sessionStorage.clear();
    localStorage.clear();
  });
  await page.reload();

  // 2. Tap FIGHT — the Landing CTA.
  const fightButton = page.getByRole('button', { name: /FIGHT/i });
  await expect(fightButton).toBeVisible();
  await fightButton.click();

  // 3. Drive 9 duels. Alternate picks starting with 'old' so the run lands on
  //    5 olds + 4 news → "Switch-Hitter".
  for (let i = 0; i < 9; i++) {
    const oldCard = page.locator('.fighter-card-old');
    const newCard = page.locator('.fighter-card-new');

    // Wait for both cards (one is enough as the gate; we lock on .first() for
    // resilience against multiple matching nodes in transitional renders).
    await expect(oldCard.first()).toBeVisible();
    await expect(newCard.first()).toBeVisible();

    // Even iterations → old, odd iterations → new. 5 olds (i=0,2,4,6,8) + 4
    // news (i=1,3,5,7) → "Switch-Hitter".
    const target = i % 2 === 0 ? oldCard : newCard;
    await target.first().click();

    // Let the pick animation / state transition settle, then click NEXT.
    const nextButton = page.getByRole('button', { name: /NEXT FIGHTER/i });
    await expect(nextButton).toBeVisible();
    await nextButton.click();
  }

  // 4. Verdict screen — assert the archetype name and stats lockup render.
  const verdictScreen = page.getByTestId('verdict-screen');
  await expect(verdictScreen).toBeVisible();

  await expect(page.getByText('Switch-Hitter')).toBeVisible();

  // Stats lockup format from VerdictCard: "{oldPicks}/9 OLD · {newPicks}/9 NEW".
  const stats = page.getByTestId('verdict-stats');
  await expect(stats).toContainText('5/9 OLD');
  await expect(stats).toContainText('4/9 NEW');
});
