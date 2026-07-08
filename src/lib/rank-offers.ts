/**
 * Phase 2 — constraint gating (the deterministic half of ranking).
 *
 * This is the guardrail layer. It applies the user's constraints to
 * normalized offers and sorts each offer into one of three tiers:
 *
 *   - eligible   : passes every hard filter AND is within budget.
 *                  Auto-bookable in Phase 3's automated mode.
 *   - tolerance  : over budget by <= the tolerance band (default 20%), but
 *                  stops + duration are both met. KEPT and flagged as an
 *                  escalation candidate — never auto-bookable. This is the
 *                  "closest option, but $X over your budget" moment (PRD §8).
 *   - rejected   : violates a hard filter (stops or duration) OR is over
 *                  budget beyond the tolerance band. Kept with reasons so the
 *                  UI / escalation can explain *why* it was dropped.
 *
 * The auto-vs-escalate trust boundary is defined entirely here, in code, so
 * it's unit-testable and correct-by-construction (PRD §5/§8). The *ordering*
 * of survivors into preferred vs. secondary is deliberately NOT done here —
 * that's the agent's job (agent-reasoned ranking, Alok's call 2026-07-07).
 * Airline preference is a soft signal surfaced for the agent, never a filter.
 */

import type { NormalizedOffer } from './normalize-offer.js';
import { type Constraints, budgetTolerance } from './constraints.js';

export type OfferTier = 'eligible' | 'tolerance' | 'rejected';

/** Result of a single constraint check against one offer. */
export interface CheckResult {
  /** Did the offer satisfy this constraint? A check that doesn't apply (the
   *  constraint is unset) passes with `applicable: false`. */
  pass: boolean;
  applicable: boolean;
  /** Human-readable explanation, present whether it passed or failed. */
  detail: string;
}

export interface BudgetCheck extends CheckResult {
  /** Fractional amount over budget: (price - maxPrice) / maxPrice. 0 or
   *  negative means within budget. Null when no budget constraint is set. */
  overBudgetPct: number | null;
  /** Absolute amount over budget in the offer's currency. Null if no budget
   *  set or the offer is within budget. */
  overBudgetAmount: number | null;
  /** True when over budget but within the tolerance band. */
  withinTolerance: boolean;
}

export interface EvaluatedOffer {
  offer: NormalizedOffer;
  tier: OfferTier;
  budget: BudgetCheck;
  stops: CheckResult;
  duration: CheckResult;
  /** Soft signal: is the offer's airline in the user's preferred list? Never
   *  affects the tier — surfaced only for the agent's ordering decision. */
  airlineMatch: boolean;
  /** Compact reasons the offer landed in its tier (failures + flags). */
  reasons: string[];
}

export interface ClassifiedOffers {
  eligible: EvaluatedOffer[];
  tolerance: EvaluatedOffer[];
  rejected: EvaluatedOffer[];
  /** Echo of the constraints used, for logging / UI. */
  constraints: Constraints;
}

// --- Individual checks ------------------------------------------------------

function checkStops(offer: NormalizedOffer, constraints: Constraints): CheckResult {
  if (constraints.maxStops == null) {
    return { pass: true, applicable: false, detail: 'no max-stops constraint' };
  }
  const worst = offer.maxStopsAcrossSlices;
  const pass = worst <= constraints.maxStops;
  return {
    pass,
    applicable: true,
    detail: pass
      ? `${worst} stop(s) <= max ${constraints.maxStops}`
      : `${worst} stop(s) exceeds max ${constraints.maxStops}`,
  };
}

function checkDuration(
  offer: NormalizedOffer,
  constraints: Constraints,
): CheckResult {
  if (constraints.maxTotalDurationMinutes == null) {
    return { pass: true, applicable: false, detail: 'no max-duration constraint' };
  }
  const total = offer.totalDurationMinutes;
  // Conservative: if a duration limit is set but we can't compute the offer's
  // duration, we can't prove it complies, so it fails. Better to surface it as
  // a near-miss than to auto-book something unverifiable.
  if (total == null) {
    return {
      pass: false,
      applicable: true,
      detail: `duration unknown, cannot verify against max ${constraints.maxTotalDurationMinutes}m`,
    };
  }
  const pass = total <= constraints.maxTotalDurationMinutes;
  return {
    pass,
    applicable: true,
    detail: pass
      ? `${total}m <= max ${constraints.maxTotalDurationMinutes}m`
      : `${total}m exceeds max ${constraints.maxTotalDurationMinutes}m`,
  };
}

function checkBudget(
  offer: NormalizedOffer,
  constraints: Constraints,
): BudgetCheck {
  const tolerance = budgetTolerance(constraints);

  if (constraints.maxPrice == null) {
    return {
      pass: true,
      applicable: false,
      detail: 'no budget constraint',
      overBudgetPct: null,
      overBudgetAmount: null,
      withinTolerance: false,
    };
  }

  // Single-currency assumption (POC). If the offer's currency differs from the
  // stated budget currency, we can't compare safely — flag, don't guess.
  if (constraints.currency && offer.priceCurrency !== constraints.currency) {
    return {
      pass: false,
      applicable: true,
      detail: `offer priced in ${offer.priceCurrency}, budget in ${constraints.currency} — no FX conversion in v1`,
      overBudgetPct: null,
      overBudgetAmount: null,
      withinTolerance: false,
    };
  }

  const overAmount = offer.priceAmount - constraints.maxPrice;
  const overPct = overAmount / constraints.maxPrice;

  if (overAmount <= 0) {
    return {
      pass: true,
      applicable: true,
      detail: `${offer.priceAmount.toFixed(2)} ${offer.priceCurrency} within budget ${constraints.maxPrice.toFixed(2)}`,
      overBudgetPct: overPct,
      overBudgetAmount: null,
      withinTolerance: false,
    };
  }

  const withinTolerance = overPct <= tolerance;
  return {
    pass: false, // "pass" here means within budget; tolerance is handled at tiering
    applicable: true,
    detail: withinTolerance
      ? `${overAmount.toFixed(2)} ${offer.priceCurrency} over budget (${(overPct * 100).toFixed(1)}%, within ${(tolerance * 100).toFixed(0)}% tolerance)`
      : `${overAmount.toFixed(2)} ${offer.priceCurrency} over budget (${(overPct * 100).toFixed(1)}%, beyond ${(tolerance * 100).toFixed(0)}% tolerance)`,
    overBudgetPct: overPct,
    overBudgetAmount: overAmount,
    withinTolerance,
  };
}

// --- Classification ---------------------------------------------------------

/**
 * Evaluates one offer against the constraints and assigns its tier.
 *
 * Tiering rules (order matters):
 *   1. Any hard-filter failure (stops or duration) → rejected.
 *   2. Within budget (and hard filters pass)        → eligible.
 *   3. Over budget but within tolerance             → tolerance.
 *   4. Over budget beyond tolerance                 → rejected.
 */
export function evaluateOffer(
  offer: NormalizedOffer,
  constraints: Constraints,
): EvaluatedOffer {
  const stops = checkStops(offer, constraints);
  const duration = checkDuration(offer, constraints);
  const budget = checkBudget(offer, constraints);
  const airlineMatch = isPreferredAirline(offer, constraints);

  const reasons: string[] = [];
  const hardFilterFailed = !stops.pass || !duration.pass;

  let tier: OfferTier;
  if (hardFilterFailed) {
    tier = 'rejected';
    if (!stops.pass) reasons.push(stops.detail);
    if (!duration.pass) reasons.push(duration.detail);
    // Note budget context too even on a hard reject, for a complete picture.
    if (budget.applicable && !budget.pass) reasons.push(budget.detail);
  } else if (budget.pass) {
    tier = 'eligible';
  } else if (budget.withinTolerance) {
    tier = 'tolerance';
    reasons.push(budget.detail);
  } else {
    tier = 'rejected';
    reasons.push(budget.detail);
  }

  if (airlineMatch) {
    reasons.push(`on preferred airline (${offer.airlineIataCode ?? offer.airlineName})`);
  }

  return { offer, tier, budget, stops, duration, airlineMatch, reasons };
}

function isPreferredAirline(
  offer: NormalizedOffer,
  constraints: Constraints,
): boolean {
  const preferred = constraints.preferredAirlines;
  if (!preferred || preferred.length === 0) return false;
  const wanted = preferred.map((c) => c.toUpperCase());
  const code = offer.airlineIataCode?.toUpperCase();
  const name = offer.airlineName?.toUpperCase();
  return (
    (code != null && wanted.includes(code)) ||
    (name != null && wanted.includes(name))
  );
}

/**
 * Classifies a list of offers into eligible / tolerance / rejected tiers.
 *
 * Within each tier, offers are given a sensible DEFAULT order (price
 * ascending; ties broken by shorter duration, then preferred-airline first)
 * so the terminal print and any non-agent fallback are deterministic. The
 * agent is free to re-order using the per-offer detail — that's the
 * agent-reasoned ranking step.
 */
export function classifyOffers(
  offers: NormalizedOffer[],
  constraints: Constraints,
): ClassifiedOffers {
  const evaluated = offers.map((o) => evaluateOffer(o, constraints));

  const byDefaultOrder = (a: EvaluatedOffer, b: EvaluatedOffer): number => {
    if (a.offer.priceAmount !== b.offer.priceAmount) {
      return a.offer.priceAmount - b.offer.priceAmount;
    }
    const ad = a.offer.totalDurationMinutes ?? Number.POSITIVE_INFINITY;
    const bd = b.offer.totalDurationMinutes ?? Number.POSITIVE_INFINITY;
    if (ad !== bd) return ad - bd;
    // Preferred airline first as the final tiebreak.
    return Number(b.airlineMatch) - Number(a.airlineMatch);
  };

  return {
    eligible: evaluated.filter((e) => e.tier === 'eligible').sort(byDefaultOrder),
    tolerance: evaluated.filter((e) => e.tier === 'tolerance').sort(byDefaultOrder),
    rejected: evaluated.filter((e) => e.tier === 'rejected').sort(byDefaultOrder),
    constraints,
  };
}
