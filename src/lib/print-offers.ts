/**
 * Terminal formatting for normalized offers. This is the "print ranked
 * results in the terminal" deliverable from PRD §7 Phase 1 — a plain
 * price-ascending list, not Phase 2's constraint-based preferred/secondary
 * ranking.
 */

import type { NormalizedOffer, NormalizedSlice } from './normalize-offer.js';

function formatSlice(slice: NormalizedSlice): string {
  const stopsLabel =
    slice.stops === 0 ? 'direct' : `${slice.stops} stop${slice.stops > 1 ? 's' : ''}`;
  const durationLabel =
    slice.durationMinutes != null
      ? `${Math.floor(slice.durationMinutes / 60)}h${String(slice.durationMinutes % 60).padStart(2, '0')}m`
      : 'unknown duration';
  const carriers = [
    ...new Set(slice.segments.map((s) => s.marketingCarrierName)),
  ].join(', ');

  return `${slice.originIataCode} -> ${slice.destinationIataCode}  ${slice.departingAt} -> ${slice.arrivingAt}  (${durationLabel}, ${stopsLabel}, ${carriers})`;
}

export function formatOffersTable(offers: NormalizedOffer[]): string {
  if (offers.length === 0) {
    return '(no offers returned)';
  }

  return offers
    .map((offer, index) => {
      const header = `#${index + 1}  ${offer.airlineName} (${offer.airlineIataCode ?? '??'})  ${offer.priceAmount.toFixed(2)} ${offer.priceCurrency}  [offer ${offer.id}]`;
      const slices = offer.slices.map((slice, i) => `    slice ${i + 1}: ${formatSlice(slice)}`);
      return [header, ...slices].join('\n');
    })
    .join('\n\n');
}

export function printRankedOffers(offers: NormalizedOffer[]): void {
  console.log(`\n--- ${offers.length} offer(s), sorted by price (ascending) ---\n`);
  console.log(formatOffersTable(offers));
  console.log('');
}
