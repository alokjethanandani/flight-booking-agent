/**
 * Phase 4 — wraps `query()` for the browser (HLD §3/§4/§7).
 *
 * This is a parallel entrypoint to `phase3-two-modes.ts`, not a refactor of
 * it: the CLI file is left unchanged as a fallback demo path (HLD §10), and
 * every tool defined here mirrors its Phase 3 counterpart's contract exactly
 * (same tool names, same MOCK booking, same read-only imports from `lib/`).
 * The only behavioral difference: `rank_offers` here always applies the
 * constraints the Settings panel sent with `/api/run`, rather than trusting
 * the model to restate them — the constraints panel is the guardrail source
 * of truth (UX brief §A4), not something for the model to reconstruct from
 * a natural-language sentence.
 *
 * A deliberate limitation, flagged rather than shipped quietly (CLAUDE.md
 * §6): `createOversightGate({ mode })` (lib/oversight.ts, read-only this
 * phase) captures `mode` by value when the gate is built for a run. Genuine
 * mid-run mode switching would require that file to read a live/mutable
 * mode, which would move the trust boundary — out of scope here. A mode
 * change while a run is in flight applies to the *next* run only; the
 * in-flight gate keeps the mode it started with. The SPA must say so
 * honestly rather than claim a live re-evaluation it can't deliver.
 *
 * Single-run-at-a-time by construction: `lib/oversight.ts` keeps its
 * classification/decision-log state in module-level variables (not
 * per-call), so two concurrent runs would corrupt each other's gate state.
 * `registerRun` rejects a new run while one is still active.
 */

import { randomUUID } from 'node:crypto';
import type { Response } from 'express';
import { z } from 'zod';
import {
  query,
  tool,
  createSdkMcpServer,
  type SDKMessage,
  type CanUseTool,
} from '@anthropic-ai/claude-agent-sdk';
import { DuffelError } from '@duffel/api';

import { searchFlights } from '../lib/search-flights.js';
import { formatOffersTable } from '../lib/print-offers.js';
import {
  saveSearchResult,
  getSearchResult,
  findOfferById,
} from '../lib/offer-store.js';
import { classifyOffers, type EvaluatedOffer } from '../lib/rank-offers.js';
import type { Constraints } from '../lib/constraints.js';
import { formatClassifiedOffers } from '../lib/print-classified.js';
import { bookFlight } from '../lib/book-flight.js';
import {
  createOversightGate,
  recordClassification,
  getCurrentClassification,
  getDecisionLog,
  type Mode,
} from '../lib/oversight.js';
import type { AnswerProvider } from '../lib/prompt-io.js';
import { buildDemoOffers } from '../lib/demo-fixtures.js';

import { SseChannel } from './sse.js';
import { createWebAnswerProvider } from './web-answer-provider.js';
import type {
  RunRequestBody,
  OfferSummaryForUI,
  OffersPayload,
  EscalationPayload,
  EscalationOption,
  LoopStepPayload,
  AssistantTextPayload,
  PlanPreviewPayload,
  ErrorPayload,
} from './types.js';

// --- Run state ---------------------------------------------------------------

interface PendingRun {
  body: RunRequestBody;
}

interface ActiveRun {
  mode: Mode;
  sse: SseChannel;
  pendingResolve: ((answer: string) => void) | null;
  lastRequestedOfferId?: string;
  decisionLogStartIndex: number;
}

const pendingRuns = new Map<string, PendingRun>();
const activeRuns = new Map<string, ActiveRun>();

export class RunAlreadyActiveError extends Error {
  constructor() {
    super(
      'A run is already in progress this session. The oversight gate keeps ' +
        'its state in module-level variables (by design — see lib/oversight.ts), ' +
        'so only one run may be active at a time. Wait for it to finish.',
    );
    this.name = 'RunAlreadyActiveError';
  }
}

export function registerRun(body: RunRequestBody): string {
  if (activeRuns.size > 0) {
    throw new RunAlreadyActiveError();
  }
  const runId = randomUUID();
  pendingRuns.set(runId, { body });
  return runId;
}

/** Returns false if runId is unknown (already attached, or never registered). */
export function attachStream(runId: string, res: Response): boolean {
  const pending = pendingRuns.get(runId);
  if (!pending) return false;
  pendingRuns.delete(runId);

  const sse = new SseChannel(res);
  const active: ActiveRun = {
    mode: pending.body.mode,
    sse,
    pendingResolve: null,
    decisionLogStartIndex: getDecisionLog().length,
  };
  activeRuns.set(runId, active);
  res.on('close', () => {
    activeRuns.delete(runId);
  });

  void runQueryLoop(runId, pending.body, active);
  return true;
}

/** Returns false if runId is unknown or nothing is currently parked. */
export function submitDecision(runId: string, answer: string): boolean {
  const active = activeRuns.get(runId);
  if (!active || !active.pendingResolve) return false;
  const resolve = active.pendingResolve;
  active.pendingResolve = null;
  resolve(answer);
  return true;
}

// --- Offer display helpers (presentational only — no tier/decision logic) ---

function toOfferSummary(e: EvaluatedOffer, number?: number): OfferSummaryForUI {
  return {
    offerId: e.offer.id,
    tier: e.tier,
    number,
    airlineName: e.offer.airlineName,
    airlineIataCode: e.offer.airlineIataCode,
    priceAmount: e.offer.priceAmount,
    priceCurrency: e.offer.priceCurrency,
    totalDurationMinutes: e.offer.totalDurationMinutes,
    maxStopsAcrossSlices: e.offer.maxStopsAcrossSlices,
    reasons: e.reasons,
    budgetDetail: e.budget.detail,
  };
}

/**
 * Builds the escalation SSE payload. Reads the same classification the gate
 * itself just consulted (`getCurrentClassification()`) and reconstructs the
 * identical `[...eligible, ...tolerance]` selectable ordering oversight.ts
 * uses internally for HITL numbered reselection — display enumeration of
 * already-computed data, not a new eligibility decision.
 */
function buildEscalationPayload(
  prompt: string,
  active: ActiveRun,
  isFreeText: boolean,
): EscalationPayload {
  const classification = getCurrentClassification();
  if (isFreeText || !classification) {
    return { mode: active.mode, prompt, options: [], offers: [], isFreeText: true };
  }

  const selectable = [...classification.eligible, ...classification.tolerance];
  const offers = selectable.map((e, i) => toOfferSummary(e, i + 1));
  const options: EscalationOption[] = [];

  if (active.mode === 'automated') {
    options.push({ value: 'y', label: 'Approve anyway' });
    options.push({ value: 'n', label: 'Decline' });
  } else {
    options.push({ value: 'y', label: 'Approve recommended' });
    selectable.forEach((e, i) => {
      if (e.offer.id !== active.lastRequestedOfferId) {
        options.push({
          value: String(i + 1),
          label: `Book #${i + 1} instead — ${e.offer.airlineName} ${e.offer.priceAmount.toFixed(0)} ${e.offer.priceCurrency}`,
        });
      }
    });
    options.push({ value: 'n', label: 'Decline' });
  }

  return {
    mode: active.mode,
    prompt,
    requestedOfferId: active.lastRequestedOfferId,
    options,
    offers,
    isFreeText: false,
  };
}

// --- Tools (mirror phase3-two-modes.ts's contracts; SSE instead of console) -

function describeSearchError(err: unknown): { model: string } {
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

function buildSearchTool(active: ActiveRun, offline: boolean) {
  return tool(
    'search_flights',
    'Search real flight offers via Duffel for a one-way or round-trip. Returns ' +
      'a searchId and a price-sorted summary. Call rank_offers next.',
    {
      origin: z.string().describe('Origin airport IATA code, e.g. "AUS"'),
      destination: z.string().describe('Destination airport IATA code, e.g. "JFK"'),
      departureDate: z.string().describe('Departure date, ISO 8601 (YYYY-MM-DD)'),
      returnDate: z.string().optional().describe('Return date, ISO 8601. Omit for one-way.'),
      passengerCount: z.number().int().min(1).default(1).describe('Adult passengers. v1 adults only.'),
      cabinClass: z
        .enum(['first', 'business', 'premium_economy', 'economy'])
        .default('economy')
        .describe('Cabin class.'),
    },
    async ({ origin, destination, departureDate, returnDate, passengerCount, cabinClass }) => {
      active.sse.send('loop_step', { label: 'searching' } satisfies LoopStepPayload);
      try {
        const offers = offline
          ? buildDemoOffers()
          : await searchFlights(
              { origin, destination, departureDate, returnDate, passengerCount, cabinClass },
              'prod',
            );
        const searchId = saveSearchResult(offers);
        const summaryForModel = formatOffersTable(offers.slice(0, 10));
        return {
          content: [
            {
              type: 'text' as const,
              text:
                offers.length === 0
                  ? 'No offers found for this search.'
                  : `searchId: ${searchId}\n${offers.length} offer(s), price ascending (up to 10):\n\n${summaryForModel}\n\nNow call rank_offers with searchId "${searchId}".`,
            },
          ],
        };
      } catch (err) {
        const { model: modelMsg } = describeSearchError(err);
        active.sse.send('error', { message: modelMsg } satisfies ErrorPayload);
        return { isError: true, content: [{ type: 'text' as const, text: modelMsg }] };
      }
    },
  );
}

function buildRankOffersTool(active: ActiveRun, constraints: Constraints) {
  return tool(
    'rank_offers',
    'Apply the user\'s configured constraints (from the Settings panel — you ' +
      'do not need to restate them) to a completed search and sort offers ' +
      'into eligible / tolerance / rejected tiers. Returns the tiers for you ' +
      'to order into a preferred pick + secondary options.',
    {
      searchId: z.string().optional().describe('searchId from search_flights. Omit for the latest.'),
    },
    async ({ searchId }) => {
      active.sse.send('loop_step', { label: 'ranking' } satisfies LoopStepPayload);
      const found = getSearchResult(searchId);
      if (!found) {
        const message = `No search results found${searchId ? ` for searchId "${searchId}"` : ''}. Call search_flights first.`;
        return { isError: true, content: [{ type: 'text' as const, text: message }] };
      }

      const classified = classifyOffers(found.offers, constraints);
      recordClassification(classified);
      active.sse.send('offers', {
        eligible: classified.eligible.map((e) => toOfferSummary(e)),
        tolerance: classified.tolerance.map((e) => toOfferSummary(e)),
        rejected: classified.rejected.map((e) => toOfferSummary(e)),
      } satisfies OffersPayload);

      const guidance =
        '\n\nChoose from the ELIGIBLE tier. To proceed, call book_flight with the ' +
        'offerId of your recommended pick — the system enforces the booking policy ' +
        'for your mode (auto-book vs. ask the user), so just make your best pick. ' +
        'If ELIGIBLE is empty but TOLERANCE has an option, still call book_flight ' +
        'on the closest one — the system will escalate to the user rather than ' +
        'booking silently. If everything is rejected, explain why and do not book.';

      return {
        content: [
          {
            type: 'text' as const,
            text: `Gated results for ${found.searchId}:\n\n${formatClassifiedOffers(classified)}${guidance}`,
          },
        ],
      };
    },
  );
}

function buildBookFlightTool(active: ActiveRun) {
  return tool(
    'book_flight',
    'MOCK-book a specific offer by offerId. Returns a fabricated confirmation ' +
      '(fake PNR) — it never issues a real ticket, takes payment, or calls any ' +
      'airline. Booking policy (auto vs. ask the user) is enforced by the system ' +
      'before this runs; you just request the booking.',
    {
      offerId: z.string().describe('The offer id to book (from the ranked results).'),
      passengerCount: z.number().int().min(1).default(1).describe('Adult passengers on the booking.'),
    },
    async ({ offerId, passengerCount }) => {
      const offer = findOfferById(offerId);
      if (!offer) {
        const message = `No offer "${offerId}" in this session's searches. Re-run search_flights / rank_offers.`;
        return { isError: true, content: [{ type: 'text' as const, text: message }] };
      }
      const result = bookFlight(offer, { passengerCount });
      active.sse.send('confirmation', result);

      if (result.status === 'offer_expired') {
        return {
          content: [{ type: 'text' as const, text: `MOCK BOOKING NOT MADE — ${result.message}` }],
        };
      }
      return {
        content: [
          {
            type: 'text' as const,
            text:
              `MOCK BOOKING CONFIRMED (not a real ticket). PNR ${result.pnr}, ref ${result.bookingReference}. ` +
              `${result.airline} — ${result.priceAmount.toFixed(2)} ${result.priceCurrency} for ${result.passengerCount} passenger(s). ` +
              `Offer ${result.offerId}. ${result.notice}`,
          },
        ],
      };
    },
  );
}

function buildAskUserTool(answers: AnswerProvider) {
  return tool(
    'ask_user',
    'Ask the human a clarifying question and get their reply (e.g. a missing ' +
      'trip detail). NOTE: this is NOT how bookings get approved — booking ' +
      'approval is handled automatically by the system when you call book_flight.',
    { question: z.string().describe('The question to ask the user.') },
    async ({ question }) => {
      const answer = await answers.ask(question);
      return { content: [{ type: 'text' as const, text: answer || '(no answer given)' }] };
    },
  );
}

function systemPromptFor(mode: Mode): string {
  const shared =
    'You are a consumer flight-booking agent (a POC), driving a web UI. Tools: ' +
    'search_flights (real Duffel search), rank_offers (deterministic constraint ' +
    'gate — applies the user\'s Settings-panel constraints automatically), ' +
    'book_flight (MOCK — no real ticket), ask_user (clarifications only). ' +
    'Always search, then rank_offers, before booking. Never fabricate flight ' +
    'data or confirmations. If a booking is denied by the system, respect it ' +
    'and explain; if an offer expired, call search_flights again. Use ask_user ' +
    'only for missing trip details (e.g. an ambiguous city), never to get ' +
    'booking approval.';

  if (mode === 'automated') {
    return (
      `${shared}\n\nMODE = AUTOMATED. Pick your single best option — from the ` +
      'ELIGIBLE tier when it is non-empty, otherwise the closest TOLERANCE ' +
      'option — and call book_flight on it. The system will auto-book an ' +
      'eligible pick with no prompt, and will pause to ask the user itself when ' +
      'the only option is over budget. After booking, report the PNR and briefly ' +
      'why you picked it (price, duration, stops, preferred airline).'
    );
  }
  return (
    `${shared}\n\nMODE = HUMAN-IN-THE-LOOP. First present a PREFERRED pick and ` +
    'up to 3 SECONDARY options from the ELIGIBLE tier (flag any TOLERANCE ' +
    'options as over-budget), explaining why the preferred one wins. Then call ' +
    'book_flight on your recommended pick. The system will pause and require the ' +
    'user\'s explicit approval before anything is booked — the user may approve, ' +
    'cancel, or pick a different option. Never book without calling book_flight.'
  );
}

// --- The run loop -------------------------------------------------------------

async function runQueryLoop(
  runId: string,
  body: RunRequestBody,
  active: ActiveRun,
): Promise<void> {
  try {
    active.sse.send('plan_preview', {
      mode: active.mode,
      message:
        active.mode === 'automated'
          ? "I'll auto-book the best option that meets all your rules. If nothing qualifies, I'll stop and ask."
          : "I'll find options and rank them — you make every booking call.",
    } satisfies PlanPreviewPayload);

    const setPendingResolve = (resolve: ((answer: string) => void) | null): void => {
      active.pendingResolve = resolve;
    };

    const gateAnswers = createWebAnswerProvider({
      sse: active.sse,
      setPendingResolve,
      buildEscalationPayload: (prompt) => buildEscalationPayload(prompt, active, false),
    });
    const askAnswers = createWebAnswerProvider({
      sse: active.sse,
      setPendingResolve,
      buildEscalationPayload: (prompt) => buildEscalationPayload(prompt, active, true),
    });

    const gate: CanUseTool = createOversightGate({ mode: active.mode, answers: gateAnswers });
    const wrappedGate: CanUseTool = async (toolName, input, options) => {
      const before = getDecisionLog().length;
      const result = await gate(toolName, input, options);
      const log = getDecisionLog();
      if (log.length > before) {
        active.sse.send('decision', log[log.length - 1]);
      }
      return result;
    };

    const server = createSdkMcpServer({
      name: 'phase4-web',
      version: '0.1.0',
      tools: [
        buildSearchTool(active, body.offline ?? false),
        buildRankOffersTool(active, body.constraints),
        buildBookFlightTool(active),
        buildAskUserTool(askAnswers),
      ],
    });

    const stream = query({
      prompt: body.tripRequest,
      options: {
        mcpServers: { phase4: server },
        // book_flight is intentionally NOT allow-listed — every booking is
        // routed through canUseTool (the oversight gate), exactly as in
        // phase3-two-modes.ts.
        allowedTools: [
          'mcp__phase4__search_flights',
          'mcp__phase4__rank_offers',
          'mcp__phase4__ask_user',
        ],
        permissionMode: 'default',
        canUseTool: wrappedGate,
        systemPrompt: systemPromptFor(active.mode),
      },
    });

    for await (const message of stream as AsyncIterable<SDKMessage>) {
      if (message.type === 'assistant') {
        for (const block of message.message.content) {
          if (block.type === 'text') {
            active.sse.send('assistant_text', { text: block.text } satisfies AssistantTextPayload);
          } else if (block.type === 'tool_use' && block.name.endsWith('book_flight')) {
            const input = block.input as Record<string, unknown>;
            const offerId = String(input.offerId ?? input.offer_id ?? '');
            active.lastRequestedOfferId = offerId || undefined;
            active.sse.send('loop_step', { label: 'deciding' } satisfies LoopStepPayload);
          }
        }
      }
    }

    const fullLog = getDecisionLog();
    active.sse.send('done', { decisionLog: fullLog.slice(active.decisionLogStartIndex) });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    active.sse.send('error', { message } satisfies ErrorPayload);
  } finally {
    active.sse.close();
    activeRuns.delete(runId);
  }
}
