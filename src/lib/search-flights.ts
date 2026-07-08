/**
 * Phase 1 — real Duffel search.
 *
 * Builds an offer request from trip params, calls Duffel, normalizes the
 * offers, and returns them sorted by price ascending. This is the naive
 * "ranked" list PRD §7 Phase 1 asks for — the constraint-based
 * preferred/secondary logic (budget, stops, duration, airline) is Phase 2's
 * job and deliberately isn't built here.
 */

import type { CabinClass, CreateOfferRequestSlice } from '@duffel/api/types';
import { getDuffelClient, type DuffelEnv } from './duffel-client.js';
import { normalizeOffer, type NormalizedOffer } from './normalize-offer.js';

export interface SearchFlightsParams {
  origin: string;
  destination: string;
  /** ISO 8601 date, e.g. "2026-08-15". */
  departureDate: string;
  /**
   * ISO 8601 date for the return leg. Omit for one-way. Presence of this
   * field is what makes the request round-trip (2 slices) vs. one-way (1
   * slice) — matches the PRD's locked "one-way + round-trip only" scope.
   */
  returnDate?: string;
  /**
   * All passengers are treated as adults for v1 — no child/infant fare
   * handling. That's a deliberate simplification to avoid scope creep past
   * PRD §3's constraint list (which doesn't mention passenger types), not
   * an oversight.
   */
  passengerCount: number;
  cabinClass: CabinClass;
  /** Optional; when unset, Duffel applies its own default (1 connection). */
  maxConnections?: 0 | 1 | 2;
}

export function buildOfferRequestSlices(
  params: Pick<SearchFlightsParams, 'origin' | 'destination' | 'departureDate' | 'returnDate'>,
): CreateOfferRequestSlice[] {
  const outbound: CreateOfferRequestSlice = {
    origin: params.origin,
    destination: params.destination,
    departure_date: params.departureDate,
    departure_time: null,
    arrival_time: null,
  };

  if (!params.returnDate) {
    return [outbound];
  }

  const inbound: CreateOfferRequestSlice = {
    origin: params.destination,
    destination: params.origin,
    departure_date: params.returnDate,
    departure_time: null,
    arrival_time: null,
  };

  return [outbound, inbound];
}

/**
 * Runs a real Duffel search and returns normalized offers sorted by total
 * price (ascending). `env` picks which token is used — see duffel-client.ts
 * for why this defaults to 'prod' everywhere except local dev iteration.
 */
export async function searchFlights(
  params: SearchFlightsParams,
  env: DuffelEnv = 'prod',
): Promise<NormalizedOffer[]> {
  const duffel = getDuffelClient(env);

  const response = await duffel.offerRequests.create({
    slices: buildOfferRequestSlices(params),
    passengers: Array.from({ length: params.passengerCount }, () => ({
      type: 'adult' as const,
    })),
    cabin_class: params.cabinClass,
    ...(params.maxConnections !== undefined
      ? { max_connections: params.maxConnections }
      : {}),
    return_offers: true,
  });

  const offers = response.data.offers ?? [];
  return offers.map(normalizeOffer).sort((a, b) => a.priceAmount - b.priceAmount);
}
