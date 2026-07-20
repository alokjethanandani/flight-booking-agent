/**
 * Phase 4 — shared shapes for the HTTP/SSE contract (HLD §5). Pure types; no
 * behavior. The browser renders these directly rather than re-deriving
 * anything from them.
 */

import type { Mode } from '../lib/oversight.js';
import type { OfferTier } from '../lib/rank-offers.js';
import type { Constraints } from '../lib/constraints.js';

export interface RunRequestBody {
  /** Natural-language trip request, already assembled by the SPA from its form. */
  tripRequest: string;
  constraints: Constraints;
  mode: Mode;
  /** Dev/demo escape hatch — swaps in demo-fixtures.ts instead of a live Duffel call. */
  offline?: boolean;
}

/** One offer, shaped for a result/escalation card. Derived from EvaluatedOffer — display only. */
export interface OfferSummaryForUI {
  offerId: string;
  tier: OfferTier;
  /** 1-based position in the gate's selectable set (eligible + tolerance), for HITL reselection. Unset for rejected offers. */
  number?: number;
  airlineName: string;
  airlineIataCode: string | null;
  priceAmount: number;
  priceCurrency: string;
  totalDurationMinutes: number | null;
  maxStopsAcrossSlices: number;
  reasons: string[];
  budgetDetail: string;
}

export interface OffersPayload {
  eligible: OfferSummaryForUI[];
  tolerance: OfferSummaryForUI[];
  rejected: OfferSummaryForUI[];
}

export interface EscalationOption {
  /** Exactly what /api/decision expects back as `answer`. */
  value: string;
  label: string;
}

export interface EscalationPayload {
  mode: Mode;
  /** The gate's own prompt text, verbatim — the legibility payload. */
  prompt: string;
  requestedOfferId?: string;
  options: EscalationOption[];
  /** The selectable set (HITL) or the single proposed offer (automated tolerance escalation). */
  offers: OfferSummaryForUI[];
  /** True when this pause came from ask_user (a clarifying question), not a booking approval. */
  isFreeText: boolean;
}

export interface LoopStepPayload {
  label: 'searching' | 'ranking' | 'deciding';
}

export interface AssistantTextPayload {
  text: string;
}

export interface PlanPreviewPayload {
  mode: Mode;
  message: string;
}

export interface ErrorPayload {
  message: string;
}
