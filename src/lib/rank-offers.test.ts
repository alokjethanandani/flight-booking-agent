/**
 * Phase 2 gate tests — pure, offline, deterministic.
 *
 * These are the proof that the auto-vs-escalate trust boundary holds (PRD
 * §5/§8). They run entirely on hand-built fixtures — no Duffel, no network —
 * so they're valid even while Phase 1's live search is still being debugged.
 *
 * Run: `npm test`  (tsx src/lib/rank-offers.test.ts)
 * Uses node:assert only — no test-framework dependency for a POC.
 */

import assert from 'node:assert/strict';
import type { NormalizedOffer } from './normalize-offer.js';
import { classifyOffers, evaluateOffer } from './rank-offers.js';
import type { Constraints } from './constraints.js';

// --- Fixture builder --------------------------------------------------------

interface OfferOverrides {
  id?: string;
  airlineName?: string;
  airlineIataCode?: string | null;
  priceAmount?: number;
  priceCurrency?: string;
  totalDurationMinutes?: number | null;
  maxStopsAcrossSlices?: number;
}

function makeOffer(o: OfferOverrides = {}): NormalizedOffer {
  // Use `in` checks so an explicit `null` (e.g. totalDurationMinutes: null)
  // is preserved rather than being replaced by the default via `??`.
  return {
    id: o.id ?? 'off_test',
    airlineName: o.airlineName ?? 'Test Air',
    airlineIataCode: 'airlineIataCode' in o ? (o.airlineIataCode ?? null) : 'TA',
    priceAmount: o.priceAmount ?? 300,
    priceCurrency: o.priceCurrency ?? 'USD',
    expiresAt: '2026-09-14T00:00:00Z',
    slices: [], // gates only read the summary fields below, not slices
    totalDurationMinutes:
      'totalDurationMinutes' in o ? (o.totalDurationMinutes ?? null) : 300,
    maxStopsAcrossSlices: o.maxStopsAcrossSlices ?? 0,
  };
}

// --- Tiny test harness ------------------------------------------------------

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

// Baseline constraints reused across cases: $400, direct only, <= 6h.
const base: Constraints = {
  maxPrice: 400,
  currency: 'USD',
  maxStops: 0,
  maxTotalDurationMinutes: 360,
  preferredAirlines: ['DL'],
};

console.log('\n--- Phase 2 gate tests ---\n');

test('within budget + all hard filters pass → eligible', () => {
  const e = evaluateOffer(makeOffer({ priceAmount: 350 }), base);
  assert.equal(e.tier, 'eligible');
  assert.equal(e.budget.pass, true);
});

test('over budget by 10% (stops+duration ok) → tolerance, not eligible', () => {
  const e = evaluateOffer(makeOffer({ priceAmount: 440 }), base); // 10% over
  assert.equal(e.tier, 'tolerance');
  assert.equal(e.budget.withinTolerance, true);
  assert.ok(e.budget.overBudgetAmount != null && e.budget.overBudgetAmount === 40);
});

test('exactly at 20% over (stops+duration ok) → tolerance (boundary inclusive)', () => {
  const e = evaluateOffer(makeOffer({ priceAmount: 480 }), base); // exactly 20%
  assert.equal(e.tier, 'tolerance');
});

test('over budget by 21% → rejected (beyond tolerance)', () => {
  const e = evaluateOffer(makeOffer({ priceAmount: 484 }), base); // 21% over
  assert.equal(e.tier, 'rejected');
  assert.equal(e.budget.withinTolerance, false);
});

test('within tolerance on price BUT stops violated → rejected (hard filter wins)', () => {
  const e = evaluateOffer(
    makeOffer({ priceAmount: 440, maxStopsAcrossSlices: 1 }),
    base,
  );
  assert.equal(e.tier, 'rejected');
  assert.equal(e.stops.pass, false);
});

test('within budget BUT duration violated → rejected', () => {
  const e = evaluateOffer(
    makeOffer({ priceAmount: 350, totalDurationMinutes: 400 }),
    base,
  );
  assert.equal(e.tier, 'rejected');
  assert.equal(e.duration.pass, false);
});

test('missing duration WITH duration constraint → rejected (cannot verify)', () => {
  const e = evaluateOffer(
    makeOffer({ priceAmount: 350, totalDurationMinutes: null }),
    base,
  );
  assert.equal(e.tier, 'rejected');
  assert.equal(e.duration.pass, false);
});

test('missing duration with NO duration constraint → eligible', () => {
  const e = evaluateOffer(makeOffer({ totalDurationMinutes: null }), {
    maxPrice: 400,
    currency: 'USD',
  });
  assert.equal(e.tier, 'eligible');
});

test('preferred airline is SOFT: non-preferred airline still eligible', () => {
  const e = evaluateOffer(
    makeOffer({ priceAmount: 350, airlineIataCode: 'AA' }),
    base,
  );
  assert.equal(e.tier, 'eligible');
  assert.equal(e.airlineMatch, false);
});

test('preferred airline flagged when matched (by IATA code)', () => {
  const e = evaluateOffer(
    makeOffer({ priceAmount: 350, airlineIataCode: 'DL' }),
    base,
  );
  assert.equal(e.airlineMatch, true);
  assert.equal(e.tier, 'eligible');
});

test('currency mismatch → rejected (no FX in v1), not silently compared', () => {
  const e = evaluateOffer(
    makeOffer({ priceAmount: 100, priceCurrency: 'GBP' }),
    base,
  );
  assert.equal(e.tier, 'rejected');
  assert.match(e.budget.detail, /no FX conversion/);
});

test('empty constraints → everything eligible', () => {
  const e = evaluateOffer(
    makeOffer({ priceAmount: 9999, maxStopsAcrossSlices: 3 }),
    {},
  );
  assert.equal(e.tier, 'eligible');
});

test('classifyOffers buckets a mixed set correctly', () => {
  const offers = [
    makeOffer({ id: 'a', priceAmount: 350 }), // eligible
    makeOffer({ id: 'b', priceAmount: 300 }), // eligible (cheaper)
    makeOffer({ id: 'c', priceAmount: 440 }), // tolerance (10% over)
    makeOffer({ id: 'd', priceAmount: 600 }), // rejected (over 20%)
    makeOffer({ id: 'e', priceAmount: 350, maxStopsAcrossSlices: 2 }), // rejected (stops)
  ];
  const result = classifyOffers(offers, base);
  assert.deepEqual(
    result.eligible.map((e) => e.offer.id),
    ['b', 'a'], // price-ascending default order
  );
  assert.deepEqual(result.tolerance.map((e) => e.offer.id), ['c']);
  assert.deepEqual(
    result.rejected.map((e) => e.offer.id).sort(),
    ['d', 'e'],
  );
});

test('default ordering: ties broken by duration then preferred airline', () => {
  const offers = [
    makeOffer({ id: 'slow', priceAmount: 300, totalDurationMinutes: 300, airlineIataCode: 'AA' }),
    makeOffer({ id: 'fast', priceAmount: 300, totalDurationMinutes: 200, airlineIataCode: 'AA' }),
    makeOffer({ id: 'pref', priceAmount: 300, totalDurationMinutes: 200, airlineIataCode: 'DL' }),
  ];
  const result = classifyOffers(offers, base);
  // Same price: shorter duration first; among equal duration, preferred first.
  assert.deepEqual(
    result.eligible.map((e) => e.offer.id),
    ['pref', 'fast', 'slow'],
  );
});

console.log(`\n--- ${passed} passed, ${failed} failed ---\n`);
if (failed > 0) process.exit(1);
