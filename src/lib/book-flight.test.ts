/**
 * Phase 3 — mock-boundary tests for book_flight.
 *
 * The ONE guardrail that isn't optional (CLAUDE.md §1/§5): prove no booking
 * path can reach a real Duffel order. These tests do that two ways:
 *   1. BEHAVIOURAL — bookFlight always returns a fabricated, `mock: true`
 *      result; expiry is handled without fabricating a confirmation.
 *   2. STATIC self-scan — read book-flight.ts's own source and assert it
 *      imports nothing from @duffel and names no order-creation endpoint. This
 *      catches a future edit that tries to wire in a real order call, before it
 *      can ever ship.
 *
 * Pure + offline. Run via `npm test` (added to the test script alongside the
 * Phase 2 gate tests). node:assert only — no framework, matching rank-offers.test.ts.
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import type { NormalizedOffer } from './normalize-offer.js';
import { bookFlight, generateMockPnr } from './book-flight.js';

// --- Fixture ----------------------------------------------------------------

function makeOffer(o: Partial<NormalizedOffer> = {}): NormalizedOffer {
  return {
    id: o.id ?? 'off_test',
    airlineName: o.airlineName ?? 'Test Air',
    airlineIataCode: o.airlineIataCode ?? 'TA',
    priceAmount: o.priceAmount ?? 300,
    priceCurrency: o.priceCurrency ?? 'USD',
    // Far-future default so it's "live" unless a test overrides it.
    expiresAt: o.expiresAt ?? '2099-01-01T00:00:00Z',
    slices: o.slices ?? [
      {
        originIataCode: 'AUS',
        destinationIataCode: 'JFK',
        departingAt: '2026-09-14T08:00:00Z',
        arrivingAt: '2026-09-14T12:30:00Z',
        durationMinutes: 270,
        stops: 0,
        segments: [],
      },
    ],
    totalDurationMinutes: o.totalDurationMinutes ?? 270,
    maxStopsAcrossSlices: o.maxStopsAcrossSlices ?? 0,
  };
}

// --- Harness (same style as rank-offers.test.ts) ----------------------------

let passed = 0;
let failed = 0;
function test(name: string, fn: () => void): void {
  try {
    fn();
    passed += 1;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    failed += 1;
    console.error(`  ✗ ${name}`);
    console.error(`      ${(err as Error).message}`);
  }
}

console.log('\n--- Phase 3 mock-boundary tests ---\n');

test('a live offer produces a fabricated, mock-flagged confirmation', () => {
  const r = bookFlight(makeOffer({ id: 'off_live' }), { pnr: 'ABC123', passengerCount: 2 });
  assert.equal(r.status, 'confirmed');
  assert.equal(r.mock, true); // must be explicitly flagged as mock
  if (r.status !== 'confirmed') return;
  assert.equal(r.offerId, 'off_live');
  assert.equal(r.pnr, 'ABC123');
  assert.equal(r.bookingReference, 'MOCK-ABC123'); // ref can't be mistaken for real
  assert.equal(r.passengerCount, 2);
  assert.match(r.notice, /no payment was taken/i);
});

test('an EXPIRED offer is NOT booked — returns offer_expired, no confirmation', () => {
  const r = bookFlight(
    makeOffer({ id: 'off_stale', expiresAt: '2020-01-01T00:00:00Z' }),
    { now: new Date('2026-07-08T00:00:00Z') },
  );
  assert.equal(r.status, 'offer_expired');
  assert.equal(r.mock, true);
  if (r.status !== 'offer_expired') return;
  assert.equal(r.offerId, 'off_stale');
  assert.match(r.message, /re-run search_flights/i); // steers agent to recover
});

test('expiry boundary is inclusive: now === expiresAt counts as expired', () => {
  const r = bookFlight(
    makeOffer({ expiresAt: '2026-07-08T00:00:00Z' }),
    { now: new Date('2026-07-08T00:00:00Z') },
  );
  assert.equal(r.status, 'offer_expired');
});

test('generated PNRs are 6 chars, uppercase-alnum, and avoid ambiguous O', () => {
  for (let i = 0; i < 200; i += 1) {
    const pnr = generateMockPnr();
    assert.match(pnr, /^[A-NP-Z0-9]{6}$/); // 6 chars, no lowercase, no letter O
  }
});

// --- Static mock-boundary scan ----------------------------------------------

test('book-flight.ts imports NOTHING from @duffel and names no order endpoint', () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const source = readFileSync(join(here, 'book-flight.ts'), 'utf8');

  // No import from the Duffel client, in any form.
  assert.ok(
    !/from\s+['"]@duffel\/api['"]/.test(source) &&
      !/require\(\s*['"]@duffel\/api['"]\s*\)/.test(source),
    'book-flight.ts must not import @duffel/api',
  );

  // Strip comments so the guardrail prose ("touches no `orders` endpoint")
  // doesn't trip the scan — we only care about actual code.
  const code = source
    .replace(/\/\*[\s\S]*?\*\//g, '') // block comments
    .replace(/(^|[^:])\/\/.*$/gm, '$1'); // line comments

  // No reference to Duffel's order-creation surface in executable code.
  for (const forbidden of [/\.orders\b/, /orders\.create/, /\/air\/orders/, /createOrder/i]) {
    assert.ok(
      !forbidden.test(code),
      `book-flight.ts code must not reference ${forbidden}`,
    );
  }
});

console.log(`\n--- ${passed} passed, ${failed} failed ---\n`);
if (failed > 0) process.exit(1);
