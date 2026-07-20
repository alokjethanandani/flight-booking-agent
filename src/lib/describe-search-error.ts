/**
 * Formats a `search_flights` failure into a model-facing message. Split out
 * of `search-flights.ts`'s call sites so `src/server/**` never needs its own
 * `@duffel/api` import (Phase 4's server-level mock-boundary check, HLD §9,
 * is stricter than the general one: zero `@duffel/api` references anywhere
 * under `src/server/`, not just no order-creation call).
 */

import { DuffelError } from '@duffel/api';

export function describeSearchError(err: unknown): { model: string } {
  if (err instanceof DuffelError) {
    const status = err.meta?.status;
    const details =
      err.errors?.map((e) => `${e.code}: ${e.message}`).join('; ') ?? err.message;
    return {
      model: `The Duffel search failed (HTTP ${status}): ${details}. Do not guess at flight data — report this error to the user.`,
    };
  }
  const msg = err instanceof Error ? err.message : String(err);
  return {
    model: `The search_flights tool failed: ${msg}. Do not guess at flight data — report this error to the user.`,
  };
}
