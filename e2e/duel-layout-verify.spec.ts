// Regression guard for the Duel layout contract (see CLAUDE.md > Duel-specific
// helpers): side-by-side cards at every viewport, no central seam on mobile,
// vertical seam at >=900px, and the re-pick swap affordance keeps server vote
// count locked to 1 per matchup. CLAUDE.md says "Don't unit-test visual
// components" — this Playwright structural spec is the exception per the plan
// (regression guard against the layout flip silently regressing).

import { test, expect } from '@playwright/test';

// Two representative viewports cover the only branch the layout flips on:
// the <900px / >=900px seam-visibility split. Adding more widths exercises
// the same two CSS branches (per the plan's "Don't multiply visual tests"
// policy — keep the regression guard tight).
const WIDTHS = [390, 1280] as const;
// Minimum gap between cards. The CSS spec says `gap: 6px`, but we assert >= 4
// to absorb sub-pixel rounding from the browser's layout engine — boundingBox
// returns fractional pixels at non-integer device pixel ratios, and a hard
// `>= 6` assertion flakes intermittently. 4px is comfortably above any
// rounding artifact yet still catches an inline-style regression that
// collapses the gap to 0 (or worse, overlaps the cards).
const MIN_CARD_GAP_PX = 4;

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => {
    sessionStorage.clear();
    localStorage.clear();
  });
  await page.reload();
});

for (const width of WIDTHS) {
  test(`Duel layout at ${width}px wide`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });

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
    // x-disjoint with a real gap: enforce MIN_CARD_GAP_PX so an inline-style
    // regression that collapses gap to 0 (or worse, lets one card overlap
    // the other) trips this assertion.
    expect(newBox!.x - (oldBox!.x + oldBox!.width)).toBeGreaterThanOrEqual(MIN_CARD_GAP_PX);

    // Seam visibility:
    //  - mobile (<900px): .duel-seam-v is display:none (no central seam)
    //  - desktop (>=900px): .duel-seam-v is visible
    const seamV = page.getByTestId('vs-seam-v');
    if (width >= 900) {
      await expect(seamV).toBeVisible();
    } else {
      await expect(seamV).toBeHidden();
    }
    // Horizontal seam stays rendered (so the testId resolves) but is always
    // hidden by .duel-seam-h { display: none } — the era-split background
    // is the only divider on mobile.
    await expect(page.getByTestId('vs-seam-h')).toBeHidden();
  });
}

test('Re-pick swaps the locked stamp without re-voting (server vote bound to first pick)', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 800 });

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

  // 1. First pick: old → vote fires, picked-stamp lands on the old card
  //    (aria-pressed=true). Poll the vote count instead of a fixed sleep —
  //    the network call is fire-and-forget and may not be observable the
  //    instant NEXT appears.
  await oldCard.click();
  await expect(page.getByTestId('duel-next')).toBeVisible();
  await expect(oldCard).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(() => voteCallCount).toBe(1);

  // 2. Swap to new → NEXT stays visible, vote NOT re-fired, picked-stamp
  //    moves from old card to new card.
  await newCard.click();
  await expect(page.getByTestId('duel-next')).toBeVisible();
  await expect(newCard).toHaveAttribute('aria-pressed', 'true');
  await expect(oldCard).not.toHaveAttribute('aria-pressed', 'true');
  // Give the swap path a microtask window in case the JSX guard short-
  // circuited and never fired a vote; poll to confirm count stays at 1.
  await expect.poll(() => voteCallCount, { timeout: 500 }).toBe(1);

  // 3. Same-era retap on new → store + JSX both no-op; vote still not
  //    re-fired, picked-stamp stays on the new card.
  await newCard.click();
  await expect(newCard).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(() => voteCallCount, { timeout: 500 }).toBe(1);

  // The cross-step reset case is exercised by the unit test
  // (`lib/store.test.ts::after next(), the next step's first pick is treated
  // as a first-pick (not a swap)`) — no need to drive UI through to the next
  // step here, where the MuteToggle hit-test collides with the NEXT button
  // on the e2e 390px viewport.
});
