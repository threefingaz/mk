// Phase 3 e2e — /r/[code] result page + /api/og preview image (Task 30).
//
// Drives the virality surface end-to-end:
//
//   1. /r/<encoded-code> renders the friend's verdict card with the resolved
//      archetype name and the PLAY YOURSELF CTA linking back to /. The encoded
//      code is computed inline via encodeShareCode() — the test pins the picks
//      pattern (alternating, 5 olds + 4 news → "Switch-Hitter") so the rendered
//      archetype name is deterministic.
//
//   2. /api/og?code=<code> returns a 1200×630 PNG. Asserted via Playwright's
//      `request` API: 200 status, image/png content-type, non-trivial body size.
//
//   3. Malformed share codes 404. We hit /r/AAAA — a 4-char string, while valid
//      share codes are exactly 3 chars (2-byte payload, base64url). The decoder
//      rejects on length mismatch, the page handler invokes notFound(), and
//      Next.js renders the default 404 UI with a 404 response.
//
// Note: these specs do not clear storage. /r/[code] is a server component that
// reads its picks from the URL — independent of any client-side persisted run
// state — so prior-run leakage is irrelevant here.

import { test, expect } from '@playwright/test';
import { encodeShareCode } from '../lib/share-code';
import type { Era } from '../lib/fighters';

// Alternating starting with 'old' across 9 picks → 5 olds + 4 news →
// "Switch-Hitter" archetype (see lib/archetype.ts). The encoded base64url
// string is computed at test-load time so we exercise the live encoder
// alongside the live decoder on the server.
const PICKS_ALTERNATING: Era[] = [
  'old',
  'new',
  'old',
  'new',
  'old',
  'new',
  'old',
  'new',
  'old',
];

const SHARE_CODE = encodeShareCode(PICKS_ALTERNATING);

test('/r/<code> renders the friend\'s verdict card + PLAY YOURSELF CTA', async ({ page }) => {
  // Sanity check on the test fixture itself — a v1 share code is always 3 chars.
  expect(SHARE_CODE).toHaveLength(3);

  const response = await page.goto(`/r/${SHARE_CODE}`);
  expect(response?.status()).toBe(200);

  // Verdict card renders. The archetype name for 5 olds + 4 news is
  // "Switch-Hitter" — visible inside the verdict card.
  const card = page.getByTestId('verdict-card');
  await expect(card).toBeVisible();
  await expect(page.getByText('Switch-Hitter')).toBeVisible();

  // PLAY YOURSELF CTA — a real anchor pointing at the root. We assert both
  // visibility and the href so we know it's actually navigable (not just a
  // styled button).
  const cta = page.getByTestId('r-play-yourself');
  await expect(cta).toBeVisible();
  await expect(cta).toHaveAttribute('href', '/');
});

test('/api/og?code=<code> returns a 1200×630 PNG', async ({ request }) => {
  const r = await request.get(`/api/og?code=${SHARE_CODE}`);
  expect(r.status()).toBe(200);

  const contentType = r.headers()['content-type'] ?? '';
  expect(contentType).toContain('image/png');

  // Sanity check on body size — a 1200×630 PNG with real content is well
  // above 1KB. This catches "empty body" / "wrong content-type" regressions
  // without locking us into an exact byte count.
  const body = await r.body();
  expect(body.length).toBeGreaterThan(1000);
});

test('/r/<malformed> returns 404', async ({ page }) => {
  // AAAA is 4 chars — share codes are exactly 3 chars (2-byte payload encoded
  // as base64url). The length check in decodeShareCode rejects, the page
  // handler maps that to notFound(), and Next.js renders the default 404 UI.
  const response = await page.goto('/r/AAAA', { waitUntil: 'domcontentloaded' });
  expect(response?.status()).toBe(404);
});
