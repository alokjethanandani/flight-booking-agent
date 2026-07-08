/**
 * Terminal formatting for Phase 2's classified offers — eligible / tolerance
 * / rejected, each with the reason it landed there. This is the human-legible
 * view of the gate decisions (the deterministic half). The agent's
 * preferred/secondary narrative is printed separately by the agent loop.
 */

import type { NormalizedOffer } from './normalize-offer.js';
import type { ClassifiedOffers, EvaluatedOffer } from './rank-offers.js';

function priceLabel(o: NormalizedOffer): string {
  return `${o.priceAmount.toFixed(2)} ${o.priceCurrency}`;
}

function durationLabel(o: NormalizedOffer): string {
  const m = o.totalDurationMinutes;
  if (m == null) return 'dur ?';
  return `${Math.floor(m / 60)}h${String(m % 60).padStart(2, '0')}m`;
}

function stopsLabel(o: NormalizedOffer): string {
  return o.maxStopsAcrossSlices === 0
    ? 'direct'
    : `${o.maxStopsAcrossSlices} stop(s)`;
}

function formatEvaluated(e: EvaluatedOffer, index: number): string {
  const o = e.offer;
  const flags = [
    priceLabel(o),
    durationLabel(o),
    stopsLabel(o),
    o.airlineName,
    e.airlineMatch ? '★preferred-airline' : '',
  ]
    .filter(Boolean)
    .join('  ');
  const header = `  #${index + 1}  ${flags}  [${o.id}]`;
  const reasons =
    e.reasons.length > 0
      ? e.reasons.map((r) => `        - ${r}`).join('\n')
      : '        - passes all constraints';
  return `${header}\n${reasons}`;
}

function formatTier(title: string, offers: EvaluatedOffer[]): string {
  if (offers.length === 0) return `${title}: (none)`;
  const rows = offers.map((e, i) => formatEvaluated(e, i)).join('\n');
  return `${title} (${offers.length}):\n${rows}`;
}

export function formatClassifiedOffers(classified: ClassifiedOffers): string {
  const { eligible, tolerance, rejected } = classified;
  return [
    formatTier('ELIGIBLE — auto-bookable', eligible),
    '',
    formatTier('TOLERANCE — over budget within band, escalate before booking', tolerance),
    '',
    formatTier('REJECTED — violates a hard constraint', rejected),
  ].join('\n');
}

export function printClassifiedOffers(classified: ClassifiedOffers): void {
  console.log('\n--- constraint gating (deterministic) ---\n');
  console.log(formatClassifiedOffers(classified));
  console.log('');
}
