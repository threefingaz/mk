// Regression guard for the Duel layout contract (see CLAUDE.md > Duel-specific
// helpers): side-by-side cards at every viewport, no central seam on mobile,
// vertical seam at >=900px, and the re-pick swap affordance keeps server vote
// count locked to 1 per matchup. Screenshots land in e2e/.screenshots/ (git-
// ignored) for visual spot-checks; the assertions guard the structural shape.

import { test, expect } from '@playwright/test';

const WIDTHS = [320, 360, 414, 768, 899, 900, 1280] as const;

for (const width of WIDTHS) {
  test(`Duel layout at ${width}px wide`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    await page.goto('/');
    await page.evaluate(() => {
      sessionStorage.clear();
      localStorage.clear();
    });
    await page.reload();

    const fightButton = page.getByRole('button', { name: /FIGHT/i });
    await expect(fightButton).toBeVisible();
    await fightButton.click();

    const oldCard = page.locator('.fighter-card-old').first();
    const newCard = page.locator('.fighter-card-new').first();
    await expect(oldCard).toBeVisible();
    await expect(newCard).toBeVisible();

    // Both cards must be horizontally side-by-side at every width (the
    // contract of this change).
    const oldBox = await oldCard.boundingBox();
    const newBox = await newCard.boundingBox();
    expect(oldBox).not.toBeNull();
    expect(newBox).not.toBeNull();
    // y-overlap (top of one is within the other's vertical span) — both cards
    // sit at roughly the same vertical position.
    expect(Math.abs(oldBox!.y - newBox!.y)).toBeLessThan(20);
    // x-disjoint: one is to the left of the other.
    expect(oldBox!.x + oldBox!.width).toBeLessThanOrEqual(newBox!.x + 1);

    // Seam visibility:
    //  - mobile (<900px): .duel-seam-v is display:none (no central seam)
    //  - desktop (>=900px): .duel-seam-v is visible
    const seamV = page.getByTestId('vs-seam-v');
    if (width >= 900) {
      await expect(seamV).toBeVisible();
    } else {
      await expect(seamV).toBeHidden();
    }
    // Horizontal seam is always hidden in the new layout.
    await expect(page.getByTestId('vs-seam-h')).toBeHidden();

    await page.screenshot({
      path: `e2e/.screenshots/duel-${width}.png`,
      fullPage: false,
    });
  });
}

test('Re-pick swaps the locked stamp without re-voting (server vote bound to first pick)', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 800 });
  await page.goto('/');
  await page.evaluate(() => {
    sessionStorage.clear();
    localStorage.clear();
  });
  await page.reload();

  // Intercept votes to count network calls — the swap must NOT trigger a
  // second POST per the resilience contract.
  let voteCallCount = 0;
  await page.route('**/api/vote', async (route) => {
    voteCallCount += 1;
    await route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' });
  });

  const fightButton = page.getByRole('button', { name: /FIGHT/i });
  await fightButton.click();

  const oldCard = page.locator('.fighter-card-old').first();
  const newCard = page.locator('.fighter-card-new').first();

  // 1. First pick: old → vote fires.
  await oldCard.click();
  await expect(page.getByTestId('duel-next')).toBeVisible();
  await page.waitForTimeout(150);
  expect(voteCallCount).toBe(1);

  // 2. Swap to new → NEXT stays visible, vote NOT re-fired, old card becomes
  //    dimmed (no longer the picked one).
  await newCard.click();
  await expect(page.getByTestId('duel-next')).toBeVisible();
  await page.waitForTimeout(150);
  expect(voteCallCount).toBe(1);

  // 3. Same-era retap on new → store + JSX both no-op; vote still not re-fired.
  await newCard.click();
  await page.waitForTimeout(150);
  expect(voteCallCount).toBe(1);

  // The cross-step reset case is exercised by the unit test
  // (`lib/store.test.ts::after next(), the next step's first pick is treated
  // as a first-pick (not a swap)`) — no need to drive UI through to the next
  // step here, where the MuteToggle hit-test collides with the NEXT button
  // on the e2e 390px viewport.
});
