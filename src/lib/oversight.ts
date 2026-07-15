/**
 * Phase 3 — the oversight gate: where the auto-vs-ask trust boundary lives.
 *
 * THIS is the design centerpiece (PRD §8). The boundary is enforced in CODE,
 * via the SDK's `canUseTool` permission callback, which fires BEFORE any tool
 * executes. So no booking can happen unless this gate allows it — the pause is
 * a runtime guarantee, not something that depends on the agent choosing to ask.
 * (Decision, Alok 2026-07-08: canUseTool gate is the enforcement surface;
 * `ask_user` remains the agent's surface for clarifying questions.)
 *
 * Routing, driven by the active mode + the offer's tier from rank_offers'
 * deterministic classification (looked up by offer id — full fidelity, never a
 * model paraphrase):
 *
 *   AUTOMATED
 *     eligible   → ALLOW, no human. Auto-book (in budget, all hard rules met).
 *     tolerance  → ESCALATE: pause and ask the human (over budget within band).
 *     rejected   → DENY. Never auto-bookable (hard rule broken / >tolerance).
 *     unknown    → DENY. Not in the ranked set — agent must rank first.
 *
 *   HITL
 *     eligible / tolerance → PAUSE for explicit human approval every time; the
 *                            human may approve, decline, or reselect another
 *                            option (we rewrite the tool input via updatedInput).
 *     rejected / unknown   → DENY. A hard-failing offer isn't presented as
 *                            bookable even in HITL (POC line — noted in the log).
 *
 * Every decision is appended to a structured log (getDecisionLog) so Phase 4's
 * UI can render the oversight trace directly instead of re-deriving it.
 */

import type { CanUseTool, PermissionResult } from '@anthropic-ai/claude-agent-sdk';
import type { NormalizedOffer } from './normalize-offer.js';
import type { ClassifiedOffers, EvaluatedOffer, OfferTier } from './rank-offers.js';
import type { AnswerProvider } from './prompt-io.js';

export type Mode = 'automated' | 'hitl';

/** The tool this gate guards. Matched by suffix (MCP prefixes the name). */
const BOOK_TOOL_SUFFIX = 'book_flight';

export type OversightAction =
  | 'auto-book' //          automated + eligible, no human involved
  | 'escalated-approved' //  automated + tolerance, human said yes
  | 'escalated-declined' //  automated + tolerance, human said no
  | 'blocked-rejected' //    offer fails a hard rule / beyond tolerance
  | 'blocked-unknown' //     offer not in the latest ranked results
  | 'hitl-approved' //       hitl, human approved (possibly reselected)
  | 'hitl-declined'; //      hitl, human declined

/** One structured oversight decision — the record Phase 4's UI will render. */
export interface OversightDecision {
  at: string;
  mode: Mode;
  toolName: string;
  requestedOfferId: string;
  tier: OfferTier | 'unknown';
  outcome: 'allow' | 'deny';
  action: OversightAction;
  /** The "why", in plain language — this is the legibility payload. */
  reason: string;
  /** Set when the human reselected a different offer than the agent proposed. */
  finalOfferId?: string;
  /** Present when a human was consulted. */
  humanPrompt?: string;
  humanAnswer?: string;
}

// --- Cross-tool state -------------------------------------------------------

let currentClassification: ClassifiedOffers | null = null;
const decisionLog: OversightDecision[] = [];

/** rank_offers calls this so the gate can look up an offer's tier by id. */
export function recordClassification(classified: ClassifiedOffers): void {
  currentClassification = classified;
}

export function getCurrentClassification(): ClassifiedOffers | null {
  return currentClassification;
}

/** A copy of the decision trace, for the end-of-run summary / Phase 4 UI. */
export function getDecisionLog(): OversightDecision[] {
  return decisionLog.map((d) => ({ ...d }));
}

/** Test-only reset. */
export function _resetOversight(): void {
  currentClassification = null;
  decisionLog.length = 0;
}

function findEvaluated(offerId: string): EvaluatedOffer | undefined {
  if (!currentClassification) return undefined;
  const { eligible, tolerance, rejected } = currentClassification;
  return [...eligible, ...tolerance, ...rejected].find(
    (e) => e.offer.id === offerId,
  );
}

// --- Formatting helpers -----------------------------------------------------

function offerSummary(o: NormalizedOffer): string {
  const dur =
    o.totalDurationMinutes == null
      ? 'dur ?'
      : `${Math.floor(o.totalDurationMinutes / 60)}h${String(o.totalDurationMinutes % 60).padStart(2, '0')}m`;
  const stops = o.maxStopsAcrossSlices === 0 ? 'direct' : `${o.maxStopsAcrossSlices} stop(s)`;
  return `${o.priceAmount.toFixed(2)} ${o.priceCurrency}  ${dur}  ${stops}  ${o.airlineName}  [${o.id}]`;
}

// --- Answer interpretation --------------------------------------------------

function isYes(answer: string): boolean {
  return /^(y|yes)$/i.test(answer.trim());
}

function isNo(answer: string): boolean {
  return /^(n|no)$/i.test(answer.trim());
}

// --- The gate ---------------------------------------------------------------

export function createOversightGate(config: {
  mode: Mode;
  answers: AnswerProvider;
}): CanUseTool {
  const { mode, answers } = config;

  const log = (d: OversightDecision): void => {
    decisionLog.push(d);
    const arrow = d.outcome === 'allow' ? 'ALLOW' : 'DENY ';
    console.log(
      `  [oversight] ${arrow} (${mode}/${d.tier}) ${d.action} — ${d.reason}`,
    );
  };

  const allow = (input: Record<string, unknown>, extra?: Record<string, unknown>): PermissionResult => ({
    behavior: 'allow',
    updatedInput: { ...input, ...extra },
  });

  return async (toolName, input) => {
    // Only book_flight is gated; every other tool runs unimpeded.
    if (!toolName.endsWith(BOOK_TOOL_SUFFIX)) {
      return { behavior: 'allow', updatedInput: input };
    }

    const offerId = String(
      (input as Record<string, unknown>).offerId ??
        (input as Record<string, unknown>).offer_id ??
        '',
    );
    const evaluated = offerId ? findEvaluated(offerId) : undefined;
    const tier: OfferTier | 'unknown' = evaluated?.tier ?? 'unknown';

    // --- Unknown / rejected: hard denials, in either mode -------------------

    if (!evaluated) {
      const reason = offerId
        ? `offer ${offerId} is not in the latest ranked results — call rank_offers before booking`
        : 'book_flight was called without an offerId';
      log({
        at: new Date().toISOString(), mode, toolName, requestedOfferId: offerId,
        tier: 'unknown', outcome: 'deny', action: 'blocked-unknown', reason,
      });
      return { behavior: 'deny', message: reason };
    }

    if (tier === 'rejected') {
      const reason =
        `offer ${offerId} was rejected by a hard rule — not bookable in either mode ` +
        `(${evaluated.reasons.join('; ') || 'fails a hard constraint'})`;
      log({
        at: new Date().toISOString(), mode, toolName, requestedOfferId: offerId,
        tier, outcome: 'deny', action: 'blocked-rejected', reason,
      });
      return { behavior: 'deny', message: reason };
    }

    // --- AUTOMATED ----------------------------------------------------------

    if (mode === 'automated') {
      if (tier === 'eligible') {
        const reason =
          'in budget and every hard constraint met — auto-booked without asking (automated mode)';
        log({
          at: new Date().toISOString(), mode, toolName, requestedOfferId: offerId,
          tier, outcome: 'allow', action: 'auto-book', reason,
        });
        return allow(input as Record<string, unknown>);
      }

      // tier === 'tolerance' → escalation moment (PRD §8).
      const prompt =
        `\n  ┌─ ESCALATION — automated mode paused before booking ─────────────\n` +
        `  │ No option met every constraint within budget. Closest match:\n` +
        `  │   ${offerSummary(evaluated.offer)}\n` +
        `  │   ${evaluated.budget.detail}\n` +
        `  │ All other constraints ARE met. This is over your budget, so I\n` +
        `  │ will not book it automatically.\n` +
        `  └─ Book it anyway? [y = yes / anything else = no]`;
      const humanAnswer = await answers.ask(prompt);
      const approved = isYes(humanAnswer);
      const base = {
        at: new Date().toISOString(), mode, toolName, requestedOfferId: offerId,
        tier, humanPrompt: prompt, humanAnswer,
      } as const;
      if (approved) {
        const reason = `over budget (${evaluated.budget.detail}) but human approved the escalation`;
        log({ ...base, outcome: 'allow', action: 'escalated-approved', reason });
        return allow(input as Record<string, unknown>);
      }
      const reason = 'over budget and human declined the escalation — not booked';
      log({ ...base, outcome: 'deny', action: 'escalated-declined', reason });
      return { behavior: 'deny', message: reason };
    }

    // --- HITL ---------------------------------------------------------------

    // Present the selectable set (eligible first, then tolerance flagged), let
    // the human approve, decline, or reselect a different option by number.
    const selectable: EvaluatedOffer[] = [
      ...currentClassification!.eligible,
      ...currentClassification!.tolerance,
    ];
    const menu = selectable
      .map((e, i) => {
        const tag = e.tier === 'tolerance' ? '  (OVER BUDGET — escalation)' : '';
        const rec = e.offer.id === offerId ? '  ← agent recommends' : '';
        return `  │   [${i + 1}] ${offerSummary(e.offer)}${tag}${rec}`;
      })
      .join('\n');
    const overBudgetNote = tier === 'tolerance' ? '  (OVER BUDGET)' : '';
    const prompt =
      `\n  ┌─ HUMAN-IN-THE-LOOP — approval required before booking ──────────\n` +
      `  │ The agent wants to book:\n` +
      `  │   ${offerSummary(evaluated.offer)}${overBudgetNote}\n` +
      `  │ Options on the table:\n${menu}\n` +
      `  └─ Approve? [y = book the recommended one / n = cancel / number = book that one instead]`;
    const humanAnswer = await answers.ask(prompt);
    const base = {
      at: new Date().toISOString(), mode, toolName, requestedOfferId: offerId,
      tier, humanPrompt: prompt, humanAnswer,
    } as const;

    // Reselection by number.
    const asNumber = Number.parseInt(humanAnswer.trim(), 10);
    if (
      !Number.isNaN(asNumber) &&
      asNumber >= 1 &&
      asNumber <= selectable.length
    ) {
      const chosen = selectable[asNumber - 1]!;
      if (chosen.offer.id === offerId) {
        const reason = 'human approved the agent-recommended booking';
        log({ ...base, outcome: 'allow', action: 'hitl-approved', reason });
        return allow(input as Record<string, unknown>);
      }
      const reason =
        `human overrode the agent's pick and chose ${chosen.offer.id} instead ` +
        `(${chosen.tier}${chosen.tier === 'tolerance' ? ', over budget' : ''})`;
      log({
        ...base, outcome: 'allow', action: 'hitl-approved', reason,
        finalOfferId: chosen.offer.id,
      });
      return allow(input as Record<string, unknown>, { offerId: chosen.offer.id });
    }

    if (isYes(humanAnswer)) {
      const reason = 'human approved the agent-recommended booking';
      log({ ...base, outcome: 'allow', action: 'hitl-approved', reason });
      return allow(input as Record<string, unknown>);
    }

    // Anything else (including explicit "n") cancels — safe default.
    const reason = isNo(humanAnswer)
      ? 'human declined the booking'
      : `unrecognized response (${JSON.stringify(humanAnswer)}) treated as decline — not booked`;
    log({ ...base, outcome: 'deny', action: 'hitl-declined', reason });
    return { behavior: 'deny', message: reason };
  };
}

// --- End-of-run trace -------------------------------------------------------

export function formatDecisionLog(): string {
  if (decisionLog.length === 0) return 'No booking decisions were made.';
  const rows = decisionLog
    .map((d, i) => {
      const target =
        d.finalOfferId && d.finalOfferId !== d.requestedOfferId
          ? `${d.requestedOfferId} → ${d.finalOfferId}`
          : d.requestedOfferId;
      const human =
        d.humanAnswer !== undefined ? `\n        human said: ${JSON.stringify(d.humanAnswer)}` : '';
      return (
        `  ${i + 1}. [${d.outcome.toUpperCase()}] ${d.action}  (${d.mode}/${d.tier})\n` +
        `        offer: ${target}\n` +
        `        why:   ${d.reason}${human}`
      );
    })
    .join('\n');
  return `Oversight decision trace (${decisionLog.length}):\n${rows}`;
}
