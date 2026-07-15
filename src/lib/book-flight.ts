/**
 * Phase 3 — the MOCK booking action.
 *
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │ HARD GUARDRAIL (PRD §4, CLAUDE.md §1): this file NEVER books a real       │
 * │ flight. It imports nothing from `@duffel/api`, touches no `orders`        │
 * │ endpoint, takes no payment, and issues no real PNR. It fabricates a       │
 * │ confirmation object and returns it. The mock boundary is proven by        │
 * │ book-flight.test.ts (behavioural + a static self-scan of this source).    │
 * └─────────────────────────────────────────────────────────────────────────┘
 *
 * Design notes:
 *   - `bookFlight` is deliberately "dumb": it just executes and returns a
 *     fake confirmation. The auto-vs-ask trust boundary lives entirely in the
 *     canUseTool gate (oversight.ts), which runs BEFORE this ever executes.
 *   - Offer expiry: Duffel offers expire (~30 min; carried on `expiresAt`). A
 *     real booking against an expired offer fails, so the mock simulates that
 *     path too — returning `offer_expired` (prompting a re-search) rather than
 *     fabricating a confirmation for a stale offer. Cheap, and a realistic
 *     oversight beat: the agent has to recover instead of pretending it worked.
 */

import type { NormalizedOffer } from './normalize-offer.js';

/** Fabricated confirmation for a successful mock booking. */
export interface BookingConfirmation {
  status: 'confirmed';
  /** Always true. Explicit, machine-checkable marker that this is not real. */
  mock: true;
  /** Fake airline-style record locator (6 chars, e.g. "X7QK2P"). */
  pnr: string;
  /** Fake booking reference, prefixed so it can never be mistaken for real. */
  bookingReference: string;
  offerId: string;
  airline: string;
  airlineIataCode: string | null;
  priceAmount: number;
  priceCurrency: string;
  passengerCount: number;
  itinerary: BookedSlice[];
  /** ISO timestamp the mock "booking" was made. */
  bookedAt: string;
  /** Human-readable disclaimer, surfaced in the UI/terminal. */
  notice: string;
}

export interface BookedSlice {
  from: string | null;
  to: string | null;
  departingAt: string;
  arrivingAt: string;
  stops: number;
  durationMinutes: number | null;
}

/** Returned instead of a confirmation when the offer has expired. */
export interface OfferExpired {
  status: 'offer_expired';
  mock: true;
  offerId: string;
  expiresAt: string;
  checkedAt: string;
  message: string;
}

export type BookingResult = BookingConfirmation | OfferExpired;

export interface BookFlightOptions {
  passengerCount?: number;
  /** Injectable clock, for deterministic tests. Defaults to now. */
  now?: Date;
  /** Injectable PNR, for deterministic tests. Defaults to random. */
  pnr?: string;
}

const PNR_ALPHABET = 'ABCDEFGHIJKLMNPQRSTUVWXYZ0123456789'; // no 'O' (vs 0)

/** Generates a fake 6-character airline-style record locator. */
export function generateMockPnr(): string {
  let out = '';
  for (let i = 0; i < 6; i += 1) {
    out += PNR_ALPHABET[Math.floor(Math.random() * PNR_ALPHABET.length)];
  }
  return out;
}

export const MOCK_BOOKING_NOTICE =
  'MOCK BOOKING — no ticket was issued, no payment was taken, and no ' +
  'reservation exists with any airline. This confirmation is fabricated for ' +
  'the POC demo only.';

/**
 * Executes the MOCK booking for a normalized offer.
 *
 * Assumes the caller (the canUseTool gate) has already authorized this booking
 * under the active mode + the offer's tier — `bookFlight` performs NO policy
 * check itself. It only checks the one thing that is a booking-time fact rather
 * than a policy: whether the offer is still live.
 */
export function bookFlight(
  offer: NormalizedOffer,
  opts: BookFlightOptions = {},
): BookingResult {
  const now = opts.now ?? new Date();
  const expiresAt = new Date(offer.expiresAt);

  // Offer-expiry check. A real order call would fail here; we simulate it.
  if (!Number.isNaN(expiresAt.getTime()) && now.getTime() >= expiresAt.getTime()) {
    return {
      status: 'offer_expired',
      mock: true,
      offerId: offer.id,
      expiresAt: offer.expiresAt,
      checkedAt: now.toISOString(),
      message:
        `Offer ${offer.id} expired at ${offer.expiresAt} (offers are only held ` +
        `for a short window). Re-run search_flights to get fresh offers, then ` +
        `book again — do not fabricate a confirmation for a stale offer.`,
    };
  }

  const pnr = opts.pnr ?? generateMockPnr();
  return {
    status: 'confirmed',
    mock: true,
    pnr,
    bookingReference: `MOCK-${pnr}`,
    offerId: offer.id,
    airline: offer.airlineName,
    airlineIataCode: offer.airlineIataCode,
    priceAmount: offer.priceAmount,
    priceCurrency: offer.priceCurrency,
    passengerCount: opts.passengerCount ?? 1,
    itinerary: offer.slices.map((s) => ({
      from: s.originIataCode,
      to: s.destinationIataCode,
      departingAt: s.departingAt,
      arrivingAt: s.arrivingAt,
      stops: s.stops,
      durationMinutes: s.durationMinutes,
    })),
    bookedAt: now.toISOString(),
    notice: MOCK_BOOKING_NOTICE,
  };
}

/** Compact terminal rendering of a booking result. */
export function formatBookingResult(result: BookingResult): string {
  if (result.status === 'offer_expired') {
    return (
      `  ✗ OFFER EXPIRED (no booking made)\n` +
      `      offer:    ${result.offerId}\n` +
      `      expired:  ${result.expiresAt}\n` +
      `      ${result.message}`
    );
  }
  const legs = result.itinerary
    .map(
      (l) =>
        `        ${l.from ?? '?'} → ${l.to ?? '?'}  ${l.departingAt}  ` +
        `(${l.stops === 0 ? 'direct' : `${l.stops} stop(s)`})`,
    )
    .join('\n');
  return (
    `  ✓ MOCK BOOKING CONFIRMED\n` +
    `      PNR:        ${result.pnr}   (ref ${result.bookingReference})\n` +
    `      airline:    ${result.airline}` +
    `${result.airlineIataCode ? ` (${result.airlineIataCode})` : ''}\n` +
    `      price:      ${result.priceAmount.toFixed(2)} ${result.priceCurrency} ` +
    `for ${result.passengerCount} passenger(s)\n` +
    `      offer:      ${result.offerId}\n` +
    `      itinerary:\n${legs}\n` +
    `      ⚠ ${result.notice}`
  );
}
