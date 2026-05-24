// GET /api/og unit tests (Task 29).
//
// Exercises the edge route handler directly against the in-memory KV mock.
// We cover the 400 branches (missing/bad code) and a happy-path render path
// at both locked and unlocked board states.

import { beforeEach, describe, expect, it } from 'vitest';

import { GET } from './route';
import { __resetKvForTest, flipUnlocked, incrementVote } from '@/lib/kv';
import { encodeShareCode } from '@/lib/share-code';
import type { Era } from '@/lib/fighters';

const PICKS: Era[] = ['old', 'new', 'old', 'new', 'old', 'new', 'old', 'new', 'old'];

function makeRequest(url: string): Request {
  return new Request(url, { method: 'GET' });
}

beforeEach(() => {
  __resetKvForTest();
});

describe('GET /api/og', () => {
  it('returns 400 when ?code is missing', async () => {
    const res = await GET(makeRequest('http://test/api/og'));
    expect(res.status).toBe(400);
    expect(await res.text()).toBe('Missing code');
  });

  it('returns 400 when the code is malformed', async () => {
    // 4 chars — wrong length. decodeShareCode throws; route returns 400.
    const res = await GET(makeRequest('http://test/api/og?code=AAAA'));
    expect(res.status).toBe(400);
    expect(await res.text()).toBe('Bad code');
  });

  it('returns a 200 PNG when the code is valid and the board is locked', async () => {
    const code = encodeShareCode(PICKS);
    const res = await GET(makeRequest(`http://test/api/og?code=${code}`));
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toContain('image/png');
    // Cache-Control reflects the short s-maxage post-fix.
    expect(res.headers.get('Cache-Control') ?? '').toContain('s-maxage=300');
    const buf = await res.arrayBuffer();
    expect(buf.byteLength).toBeGreaterThan(1000);
  });

  it('returns a 200 PNG when the code is valid and the board is unlocked (live crowd stats path)', async () => {
    // Pre-populate some counts then flip unlocked so the renderer takes the
    // `defied` branch via lib/kv getCounts().
    await incrementVote('raiden', 'old');
    await incrementVote('raiden', 'new');
    await flipUnlocked();

    const code = encodeShareCode(PICKS);
    const res = await GET(makeRequest(`http://test/api/og?code=${code}`));
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toContain('image/png');
    const buf = await res.arrayBuffer();
    expect(buf.byteLength).toBeGreaterThan(1000);
  });
});
