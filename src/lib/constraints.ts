/**
 * Phase 2 — user constraints for filtering + ranking flight offers.
 *
 * Mirrors the PRD §3 intake list (budget, max stops, max total duration,
 * preferred airline(s)). Every field is optional: an unset constraint simply
 * doesn't apply, so a bare `{}` means "no constraints, everything is eligible."
 *
 * The auto-vs-escalate trust boundary (PRD §8) is defined entirely by how
 * these constraints are enforced in rank-offers.ts — deterministic code, not
 * agent judgment, so the boundary is testable and "correct by construction."
 */

export interface Constraints {
  /**
   * Max total trip price (all passengers, matching Duffel's `total_amount`),
   * in `currency`. A hard limit with a tolerance band — see
   * `budgetTolerancePct` and rank-offers.ts for the three-tier semantics.
   */
  maxPrice?: number;

  /**
   * ISO currency the budget is expressed in. v1 assumes a single currency
   * across offers and budget (no FX conversion — a POC simplification). If an
   * offer's currency differs, it's flagged rather than silently compared.
   */
  currency?: string;

  /** Max connections on the worst slice (0 = direct only). Hard filter. */
  maxStops?: number;

  /** Max total trip duration in minutes (sum of slices). Hard filter. */
  maxTotalDurationMinutes?: number;

  /**
   * Preferred airline IATA codes (e.g. ["DL", "AA"]). SOFT preference: an
   * offer on a non-preferred airline is NOT eliminated — it only loses the
   * airline-match signal the agent weighs when ordering. Chosen deliberately
   * (the word is "preferred," not "required").
   */
  preferredAirlines?: string[];

  /**
   * How far over `maxPrice` an offer may be and still be KEPT as an
   * escalation candidate (not auto-bookable), provided stops + duration are
   * both met. 0.20 = within 20% over budget. Alok's rule (2026-07-07).
   */
  budgetTolerancePct?: number;
}

/** Default tolerance band when a Constraints object omits it. */
export const DEFAULT_BUDGET_TOLERANCE_PCT = 0.2;

export function budgetTolerance(constraints: Constraints): number {
  return constraints.budgetTolerancePct ?? DEFAULT_BUDGET_TOLERANCE_PCT;
}
