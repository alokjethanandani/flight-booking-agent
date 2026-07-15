/**
 * Deterministic offline offers for demoing the oversight model (Phase 3).
 *
 * WHY THIS EXISTS (and why it isn't a violation of "search is real"):
 * the PRD locks *search* to real Duffel data, and that path is the default.
 * But whether an offer lands in eligible / tolerance / rejected depends on live
 * fares we can't predict, so the auto-book-vs-escalate contrast — the actual
 * point of Phase 3 — isn't reproducible against live data on demand. These
 * fixtures feed the SAME store → gate → book path with fixed numbers so both
 * modes and both routing branches are reliably screen-recordable. Dev/demo aid
 * only, gated behind `--offline`; it never books anything real either.
 *
 * Tuned against the two demo prompts (direct-only, ≤12h, prefer DL):
 *   budget 650 USD → eligible = {AA 498, DL 520, B6 610}  (auto-book path)
 *   budget 420 USD → eligible = {}, tolerance = {AA 498 @ +18.6%}  (escalate path)
 */

import type { NormalizedOffer, NormalizedSlice } from './normalize-offer.js';

function slice(
  origin: string,
  dest: string,
  depart: string,
  arrive: string,
  durationMinutes: number,
  stops: number,
): NormalizedSlice {
  return {
    originIataCode: origin,
    destinationIataCode: dest,
    departingAt: depart,
    arrivingAt: arrive,
    durationMinutes,
    stops,
    segments: [], // segments aren't read by the gate or the mock booking summary
  };
}

function offer(
  id: string,
  airlineName: string,
  airlineIataCode: string,
  priceAmount: number,
  outMinutes: number,
  outStops: number,
  backMinutes: number,
  backStops: number,
): NormalizedOffer {
  const out = slice('AUS', 'JFK', '2026-09-14T08:00:00Z', '2026-09-14T14:00:00Z', outMinutes, outStops);
  const back = slice('JFK', 'AUS', '2026-09-18T17:00:00Z', '2026-09-18T23:00:00Z', backMinutes, backStops);
  return {
    id,
    airlineName,
    airlineIataCode,
    priceAmount,
    priceCurrency: 'USD',
    // Far future so fixtures are always "live" — the expiry path is covered by
    // book-flight.test.ts rather than muddying the routing demo.
    expiresAt: '2099-01-01T00:00:00Z',
    slices: [out, back],
    totalDurationMinutes: outMinutes + backMinutes,
    maxStopsAcrossSlices: Math.max(outStops, backStops),
  };
}

/** Six fixed round-trip offers spanning eligible / tolerance / rejected. */
export function buildDemoOffers(): NormalizedOffer[] {
  return [
    offer('off_aa_direct', 'American Airlines', 'AA', 498, 290, 0, 290, 0),
    offer('off_dl_direct', 'Delta Air Lines', 'DL', 520, 300, 0, 300, 0),
    offer('off_b6_direct', 'JetBlue', 'B6', 610, 305, 0, 305, 0),
    offer('off_dl_1stop', 'Delta Air Lines', 'DL', 560, 400, 1, 400, 1),
    offer('off_ua_1stop', 'United Airlines', 'UA', 445, 350, 1, 350, 1),
    offer('off_wn_2stop', 'Southwest', 'WN', 700, 500, 2, 500, 1),
  ];
}
