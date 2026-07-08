/**
 * Normalizes a raw Duffel `Offer` into the flat internal shape that later
 * phases (Phase 2 ranking, Phase 3 mock booking) will consume. Getting this
 * shape right now avoids reshaping it twice.
 *
 * Only carries what a comparison-shopping demo needs: price, airline,
 * per-slice timing/stops, total duration. Doesn't carry fare conditions,
 * services, baggage, loyalty programme data, etc. — out of scope for this
 * POC (see PRD non-goals: no seat selection, no loyalty/points).
 */

import type { Offer, OfferSlice, OfferSliceSegment } from '@duffel/api/types';

export interface NormalizedSegment {
  marketingCarrierIataCode: string | null;
  marketingCarrierName: string;
  flightNumber: string;
  originIataCode: string | null;
  destinationIataCode: string | null;
  departingAt: string;
  arrivingAt: string;
  durationMinutes: number | null;
}

export interface NormalizedSlice {
  originIataCode: string | null;
  destinationIataCode: string | null;
  departingAt: string;
  arrivingAt: string;
  durationMinutes: number | null;
  /** Number of connections within this slice (0 = direct). */
  stops: number;
  segments: NormalizedSegment[];
}

export interface NormalizedOffer {
  id: string;
  airlineName: string;
  airlineIataCode: string | null;
  priceAmount: number;
  priceCurrency: string;
  expiresAt: string;
  slices: NormalizedSlice[];
  /** Sum of each slice's duration. Used for the naive Phase 1 sort/print. */
  totalDurationMinutes: number | null;
  /** Max stops across all slices — convenience for Phase 2's filtering. */
  maxStopsAcrossSlices: number;
}

/**
 * Parses an ISO 8601 duration (e.g. "PT5H30M", "P0DT2H") into whole minutes.
 * Returns null if the input is null or doesn't match the expected pattern.
 */
export function parseIso8601DurationToMinutes(
  duration: string | null,
): number | null {
  if (!duration) return null;
  const match = duration.match(
    /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/,
  );
  if (!match) return null;

  const days = Number(match[1] ?? 0);
  const hours = Number(match[2] ?? 0);
  const minutes = Number(match[3] ?? 0);
  const seconds = Number(match[4] ?? 0);

  return days * 24 * 60 + hours * 60 + minutes + Math.round(seconds / 60);
}

function normalizeSegment(segment: OfferSliceSegment): NormalizedSegment {
  return {
    marketingCarrierIataCode: segment.marketing_carrier.iata_code,
    marketingCarrierName: segment.marketing_carrier.name,
    flightNumber: segment.marketing_carrier_flight_number,
    originIataCode: segment.origin.iata_code,
    destinationIataCode: segment.destination.iata_code,
    departingAt: segment.departing_at,
    arrivingAt: segment.arriving_at,
    durationMinutes: parseIso8601DurationToMinutes(segment.duration),
  };
}

function normalizeSlice(slice: OfferSlice): NormalizedSlice {
  const segments = slice.segments.map(normalizeSegment);
  const firstSegment = segments[0];
  const lastSegment = segments[segments.length - 1];

  return {
    originIataCode: slice.origin.iata_code,
    destinationIataCode: slice.destination.iata_code,
    departingAt: firstSegment?.departingAt ?? '',
    arrivingAt: lastSegment?.arrivingAt ?? '',
    durationMinutes: parseIso8601DurationToMinutes(slice.duration),
    // "Stops" = connections between segments within one slice. Matches
    // Duffel's own `max_connections` semantics (0 = direct).
    stops: Math.max(0, segments.length - 1),
    segments,
  };
}

// The Offer Requests endpoint returns offers with `available_services`
// omitted (only the Get-single-offer endpoint includes it). Accepting the
// narrower type covers both call sites; normalizeOffer never reads that
// field anyway.
export function normalizeOffer(offer: Omit<Offer, 'available_services'>): NormalizedOffer {
  const slices = offer.slices.map(normalizeSlice);
  const totalDurationMinutes = slices.reduce<number | null>((acc, slice) => {
    if (slice.durationMinutes == null) return acc;
    return (acc ?? 0) + slice.durationMinutes;
  }, null);

  return {
    id: offer.id,
    airlineName: offer.owner.name,
    airlineIataCode: offer.owner.iata_code,
    priceAmount: Number(offer.total_amount),
    priceCurrency: offer.total_currency,
    expiresAt: offer.expires_at,
    slices,
    totalDurationMinutes,
    maxStopsAcrossSlices: Math.max(0, ...slices.map((s) => s.stops)),
  };
}
