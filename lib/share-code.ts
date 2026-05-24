// Share-code encode/decode (Task 27).
//
// A share code captures the 9 picks from a completed run. The defied count is
// NOT in the code — it's computed live against current crowd stats whenever the
// code is opened (per Q5: pre-unlock shares auto-upgrade once the board flips).
//
// Wire format (v1):
//   bytes 0-1  = 16-bit little-endian-ish bit field, low 9 bits hold picks
//                (bit i set = picks[i] === 'old'; cleared = 'new')
//
// 2 bytes → 3 chars base64url (no padding). 9 bits of payload.
//
// Pure functions; round-trip + malformed-input tested in share-code.test.ts.
//
// Note on bit layout: we pack picks[0]..picks[8] into the low 9 bits of a
// 16-bit value, then write that value as **little-endian** two bytes (low byte
// first, high byte second). picks[0] lands in bit 0 of byte 0, picks[8] lands
// in bit 0 of byte 1. The encoder and decoder are symmetric so the on-wire
// endianness is just an implementation detail of the round-trip.
//
// Errors are thrown as plain `Error` — the only failure modes are programmer
// bugs (wrong picks length) or untrusted input from /r/<code>; both are handled
// by the callers via try/catch.

import type { Era } from './fighters';

/** Length of a valid share code in base64url characters. */
export const SHARE_CODE_LENGTH = 3 as const;

/** Number of picks captured in a run (matches the 9 duels). */
const PICKS_LENGTH = 9 as const;

/** Byte length of the payload (2 bytes = 16 bits, holds 9 picks bits). */
const PAYLOAD_BYTES = 2 as const;

/**
 * Encode 9 picks into a 3-character base64url share code.
 *
 * Throws if picks isn't length 9 or contains any entry other than 'old' / 'new'.
 */
export function encodeShareCode(picks: Era[]): string {
  if (!Array.isArray(picks)) {
    throw new Error(`encodeShareCode: picks must be an array, got ${typeof picks}`);
  }
  if (picks.length !== PICKS_LENGTH) {
    throw new Error(
      `encodeShareCode: picks.length must be ${PICKS_LENGTH}, got ${picks.length}`,
    );
  }
  let bits = 0;
  for (let i = 0; i < PICKS_LENGTH; i++) {
    const p = picks[i];
    if (p !== 'old' && p !== 'new') {
      throw new Error(
        `encodeShareCode: picks[${i}] must be 'old' or 'new', got ${String(p)}`,
      );
    }
    if (p === 'old') {
      bits |= 1 << i;
    }
  }
  const bytes = new Uint8Array(PAYLOAD_BYTES);
  bytes[0] = bits & 0xff;
  bytes[1] = (bits >> 8) & 0xff;
  return bytesToBase64Url(bytes);
}

/**
 * Decode a share code back to its picks. Returns the 9-entry picks array
 * directly — there's no envelope; the wire format is just the picks.
 *
 * Throws on:
 *   - non-string input
 *   - empty string
 *   - wrong length (expects exactly 3 chars)
 *   - invalid base64url characters
 *   - payload that decodes to a byte count other than 2
 *   - picks bit 9..15 set (reserved bits must be zero)
 */
export function decodeShareCode(code: string): Era[] {
  if (typeof code !== 'string') {
    throw new Error(`decodeShareCode: code must be a string, got ${typeof code}`);
  }
  if (code.length === 0) {
    throw new Error('decodeShareCode: code must not be empty');
  }
  if (code.length !== SHARE_CODE_LENGTH) {
    throw new Error(
      `decodeShareCode: expected ${SHARE_CODE_LENGTH}-char code, got ${code.length}`,
    );
  }
  const bytes = base64UrlToBytes(code);
  if (bytes.length !== PAYLOAD_BYTES) {
    throw new Error(
      `decodeShareCode: expected ${PAYLOAD_BYTES}-byte payload, got ${bytes.length}`,
    );
  }
  const bits = bytes[0] | (bytes[1] << 8);
  // Defense-in-depth: bits 9..15 are reserved and must be zero. Any set
  // reserved bit means we're decoding garbage / a foreign format.
  if (bits & ~0x1ff) {
    throw new Error(`decodeShareCode: reserved bits set in payload`);
  }
  const picks: Era[] = new Array(PICKS_LENGTH);
  for (let i = 0; i < PICKS_LENGTH; i++) {
    picks[i] = (bits >> i) & 1 ? 'old' : 'new';
  }
  return picks;
}

/**
 * Reorder session-shuffled picks back to canonical FIGHTERS order
 * ([0..8]) so they can be encoded against the canonical order the
 * /r/[code] and /api/og handlers decode against.
 *
 * `picks[i]` applies to `FIGHTERS[order[i]]` in session order; the inverse
 * mapping is `canonical[order[i]] = picks[i]`. This is the function that
 * caused the CRITICAL share-code-order bug pre-iter-1 — keep it pinned here
 * next to the encoder/decoder so future callers can't get the inversion wrong.
 */
export function buildCanonicalPicks(picks: Era[], order: number[]): Era[] {
  if (picks.length !== order.length) {
    throw new Error(
      `buildCanonicalPicks: picks (${picks.length}) and order (${order.length}) must be the same length`,
    );
  }
  const canonical: Era[] = new Array(picks.length);
  for (let i = 0; i < picks.length; i++) {
    canonical[order[i]] = picks[i];
  }
  return canonical;
}

// ---------------------------------------------------------------------------
// base64url helpers — no padding, URL-safe alphabet (`-` and `_`).
//
// We avoid Node's `Buffer` so the same code runs in the Edge runtime
// (`/api/og`) and in client components. `btoa`/`atob` are available in both.
// ---------------------------------------------------------------------------

function bytesToBase64Url(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) {
    bin += String.fromCharCode(bytes[i]);
  }
  // Standard base64, then map to URL-safe and strip padding.
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// Strict base64url alphabet: A-Z, a-z, 0-9, -, _ (no `+`, no `/`, no `=`).
const BASE64URL_RE = /^[A-Za-z0-9\-_]+$/;

function base64UrlToBytes(code: string): Uint8Array {
  if (!BASE64URL_RE.test(code)) {
    throw new Error(`decodeShareCode: invalid base64url characters in "${code}"`);
  }
  // Convert URL-safe alphabet back to standard, re-pad to a multiple of 4.
  let std = code.replace(/-/g, '+').replace(/_/g, '/');
  while (std.length % 4 !== 0) {
    std += '=';
  }
  let bin: string;
  try {
    bin = atob(std);
  } catch {
    throw new Error(`decodeShareCode: malformed base64url "${code}"`);
  }
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) {
    out[i] = bin.charCodeAt(i);
  }
  return out;
}
