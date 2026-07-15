/**
 * Phase 3 — two modes (PRD §7). The design centerpiece: make the oversight
 * legible.
 *
 * Four tools now: search_flights + rank_offers (Phase 1/2) plus book_flight
 * (MOCK) and ask_user (clarification surface). The auto-vs-ask trust boundary
 * is NOT in this file's prompts — it's enforced in code by the oversight gate
 * (lib/oversight.ts) wired in as the SDK's `canUseTool`. book_flight is the one
 * tool NOT in `allowedTools`, so every booking is forced through that gate.
 *
 *   AUTOMATED  — auto-books an eligible pick with no human; escalates (pauses
 *                and asks) when only over-budget options remain; blocks hard
 *                fails. "Acts without asking when safe, pauses when not."
 *   HITL       — presents preferred + secondary, then pauses for explicit human
 *                approval before ANY booking; the human can approve, cancel, or
 *                reselect a different option.
 *
 * Booking is always mocked — no Duffel order call is reachable (see
 * lib/book-flight.ts + book-flight.test.ts). Search stays real by default;
 * `--offline` swaps in fixed demo offers so both routing paths are reproducible.
 *
 * Usage:
 *   npm run phase3:hitl                      (real search, HITL)
 *   npm run phase3:auto                      (real search, automated)
 *   tsx src/phase3-two-modes.ts --mode=automated --scenario=escalate --offline
 *   ... --answers="y"          seed human replies for a non-interactive recording
 *   ... --answers="3"          (HITL) reselect option #3 instead of the agent's pick
 */

import 'dotenv/config';

import { z } from 'zod';
import {
  query,
  tool,
  createSdkMcpServer,
  type SDKMessage,
} from '@anthropic-ai/claude-agent-sdk';
import { DuffelError } from '@duffel/api';
import { runPreflightChecks } from './lib/preflight.js';
import { searchFlights } from './lib/search-flights.js';
import { printRankedOffers, formatOffersTable } from './lib/print-offers.js';
import {
  saveSearchResult,
  getSearchResult,
  findOfferById,
} from './lib/offer-store.js';
import { classifyOffers } from './lib/rank-offers.js';
import type { Constraints } from './lib/constraints.js';
import {
  printClassifiedOffers,
  formatClassifiedOffers,
} from './lib/print-classified.js';
import { bookFlight, formatBookingResult } from './lib/book-flight.js';
import {
  createOversightGate,
  recordClassification,
  getDecisionLog,
  formatDecisionLog,
  type Mode,
} from './lib/oversight.js';
import { createAnswerProvider } from './lib/prompt-io.js';
import { buildDemoOffers } from './lib/demo-fixtures.js';

// --- CLI args ---------------------------------------------------------------

interface Args {
  mode: Mode;
  scenario: 'autobook' | 'escalate';
  offline: boolean;
  answers?: string[];
}

function parseArgs(argv: string[]): Args {
  const get = (name: string): string | undefined => {
    const hit = argv.find((a) => a.startsWith(`--${name}=`));
    return hit?.split('=').slice(1).join('=');
  };
  const has = (name: string): boolean => argv.includes(`--${name}`);

  const modeRaw = get('mode') ?? 'hitl';
  if (modeRaw !== 'automated' && modeRaw !== 'hitl') {
    throw new Error(`--mode must be "automated" or "hitl" (got "${modeRaw}")`);
  }
  const scenarioRaw = get('scenario') ?? 'autobook';
  if (scenarioRaw !== 'autobook' && scenarioRaw !== 'escalate') {
    throw new Error(`--scenario must be "autobook" or "escalate" (got "${scenarioRaw}")`);
  }
  const answersRaw = get('answers');
  return {
    mode: modeRaw,
    scenario: scenarioRaw,
    offline: has('offline'),
    answers: answersRaw ? answersRaw.split(';').map((s) => s.trim()) : undefined,
  };
}

// --- Demo prompts (budget tuned to the fixtures; see demo-fixtures.ts) ------

function demoPrompt(scenario: Args['scenario']): string {
  const budget = scenario === 'autobook' ? 650 : 420;
  return (
    'Book me a round-trip from Austin (AUS) to New York (JFK), departing ' +
    '2026-09-14 and returning 2026-09-18, for 1 adult in economy. My rules: ' +
    `budget ${budget} USD total, direct flights only (0 stops), max total ` +
    'duration 12 hours (720 minutes), and I prefer Delta (DL). Search, rank ' +
    'against those rules, then book according to your mode.'
  );
}

function describeSearchError(err: unknown): { console: string; model: string } {
  if (err instanceof DuffelError) {
    const status = err.meta?.status;
    const details =
      err.errors?.map((e) => `${e.code}: ${e.message}`).join('; ') ?? err.message;
    return {
      console: `Duffel API error (HTTP ${status}): ${details}`,
      model: `The Duffel search failed (HTTP ${status}): ${details}. Do not guess at flight data — report this error to the user.`,
    };
  }
  const msg = err instanceof Error ? err.message : String(err);
  return {
    console: err instanceof Error ? `${err.name}: ${err.message}\n${err.stack ?? ''}` : String(err),
    model: `The search_flights tool failed: ${msg}. Do not guess at flight data — report this error to the user.`,
  };
}

// --- Tools ------------------------------------------------------------------

function buildSearchTool(offline: boolean) {
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
      console.log(
        `  [tool executing] search_flights(${origin} -> ${destination}` +
          `${returnDate ? `, return ${returnDate}` : ' (one-way)'}, ${passengerCount} adult(s), ${cabinClass})` +
          `${offline ? ' [OFFLINE FIXTURES]' : ''}`,
      );

      try {
        const offers = offline
          ? buildDemoOffers()
          : await searchFlights(
              { origin, destination, departureDate, returnDate, passengerCount, cabinClass },
              'prod',
            );
        printRankedOffers(offers);
        const searchId = saveSearchResult(offers);
        const summaryForModel = formatOffersTable(offers.slice(0, 10));
        return {
          content: [
            {
              type: 'text' as const,
              text:
                offers.length === 0
                  ? 'No offers found for this search.'
                  : `searchId: ${searchId}\n${offers.length} offer(s), price ascending (up to 10):\n\n${summaryForModel}\n\nNow call rank_offers with searchId "${searchId}" and the user's constraints.`,
            },
          ],
        };
      } catch (err) {
        const { console: consoleMsg, model: modelMsg } = describeSearchError(err);
        console.error(`  [tool error] ${consoleMsg}`);
        return { isError: true, content: [{ type: 'text' as const, text: modelMsg }] };
      }
    },
  );
}

const rankOffersTool = tool(
  'rank_offers',
  'Apply the user\'s constraints to a completed search and sort offers into ' +
    'eligible / tolerance / rejected tiers. Deterministic gate: stops and ' +
    'duration are hard filters; budget has a tolerance band. Returns the tiers ' +
    'for you to order into a preferred pick + secondary options.',
  {
    searchId: z.string().optional().describe('searchId from search_flights. Omit for the latest.'),
    maxPrice: z.number().optional().describe('Max total trip price (all passengers), in budget currency.'),
    currency: z.string().optional().describe('Budget currency, e.g. "USD". No FX in v1.'),
    maxStops: z.number().int().min(0).optional().describe('Max connections on the worst slice (0 = direct). Hard filter.'),
    maxTotalDurationMinutes: z.number().int().min(0).optional().describe('Max total trip duration in minutes. Hard filter.'),
    preferredAirlines: z.array(z.string()).optional().describe('Preferred airline IATA codes. SOFT: never eliminates.'),
    budgetTolerancePct: z.number().min(0).optional().describe('Over-budget tolerance (0.20 = 20%). Default 0.20.'),
  },
  async ({ searchId, ...rest }) => {
    const found = getSearchResult(searchId);
    if (!found) {
      return {
        isError: true,
        content: [
          {
            type: 'text' as const,
            text: `No search results found${searchId ? ` for searchId "${searchId}"` : ''}. Call search_flights first.`,
          },
        ],
      };
    }

    const constraints: Constraints = {
      maxPrice: rest.maxPrice,
      currency: rest.currency,
      maxStops: rest.maxStops,
      maxTotalDurationMinutes: rest.maxTotalDurationMinutes,
      preferredAirlines: rest.preferredAirlines,
      budgetTolerancePct: rest.budgetTolerancePct,
    };
    console.log(`  [tool executing] rank_offers(${found.searchId}, ${JSON.stringify(constraints)})`);

    const classified = classifyOffers(found.offers, constraints);
    // Hand the gate the deterministic classification so it can look up an
    // offer's tier by id at book time — the trust boundary runs on this.
    recordClassification(classified);
    printClassifiedOffers(classified);

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

const bookFlightTool = tool(
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
      return {
        isError: true,
        content: [
          {
            type: 'text' as const,
            text: `No offer "${offerId}" in this session's searches. Re-run search_flights / rank_offers.`,
          },
        ],
      };
    }
    const result = bookFlight(offer, { passengerCount });
    console.log('\n--- book_flight (MOCK) ---');
    console.log(formatBookingResult(result));
    console.log('');

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

function buildAskUserTool(answers: ReturnType<typeof createAnswerProvider>) {
  return tool(
    'ask_user',
    'Ask the human a clarifying question and get their reply (e.g. a missing ' +
      'trip detail). NOTE: this is NOT how bookings get approved — booking ' +
      'approval is handled automatically by the system when you call book_flight.',
    { question: z.string().describe('The question to ask the user.') },
    async ({ question }) => {
      const answer = await answers.ask(`\n  [ask_user] ${question}`);
      return { content: [{ type: 'text' as const, text: answer || '(no answer given)' }] };
    },
  );
}

// --- System prompts (mode-specific) -----------------------------------------

function systemPromptFor(mode: Mode): string {
  const shared =
    'You are a consumer flight-booking agent (a POC). Tools: search_flights ' +
    '(real Duffel search), rank_offers (deterministic constraint gate), ' +
    'book_flight (MOCK — no real ticket), ask_user (clarifications only). ' +
    'Always search, then rank_offers with the user\'s constraints, before ' +
    'booking. Never fabricate flight data or confirmations. If a booking is ' +
    'denied by the system, respect it and explain; if an offer expired, call ' +
    'search_flights again. Use ask_user only for missing trip details, never ' +
    'to get booking approval.';

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

// --- Run --------------------------------------------------------------------

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const answers = createAnswerProvider(args.answers);

  console.log('=====================================================');
  console.log(` Phase 3 — mode: ${args.mode.toUpperCase()}   scenario: ${args.scenario}` +
    `${args.offline ? '   [OFFLINE FIXTURES]' : '   [REAL DUFFEL SEARCH]'}`);
  console.log(` human input: ${answers.scripted ? `scripted (${args.answers?.join(' | ')})` : 'live stdin'}`);
  console.log('=====================================================\n');

  if (!args.offline) {
    console.log('--- preflight ---');
    await runPreflightChecks({ duffelEnv: 'prod' });
  } else {
    console.log('--- preflight skipped (offline fixtures; no credentials needed) ---');
  }

  const server = createSdkMcpServer({
    name: 'phase3-two-modes',
    version: '0.1.0',
    tools: [buildSearchTool(args.offline), rankOffersTool, bookFlightTool, buildAskUserTool(answers)],
  });

  const prompt = demoPrompt(args.scenario);
  console.log(`\nPrompt: ${prompt}\n`);
  console.log('--- agent loop ---');

  const stream = query({
    prompt,
    options: {
      mcpServers: { phase3: server },
      // book_flight is intentionally NOT allow-listed → every booking is routed
      // through canUseTool (the oversight gate). The other three are safe to
      // auto-approve; the gate allows them anyway if consulted.
      allowedTools: [
        'mcp__phase3__search_flights',
        'mcp__phase3__rank_offers',
        'mcp__phase3__ask_user',
      ],
      permissionMode: 'default',
      canUseTool: createOversightGate({ mode: args.mode, answers }),
      systemPrompt: systemPromptFor(args.mode),
    },
  });

  for await (const message of stream as AsyncIterable<SDKMessage>) {
    switch (message.type) {
      case 'assistant': {
        for (const block of message.message.content) {
          if (block.type === 'text') {
            console.log(`  [assistant] ${block.text}`);
          } else if (block.type === 'tool_use') {
            console.log(`  [assistant -> tool_use] ${block.name}(${JSON.stringify(block.input)})`);
          }
        }
        break;
      }
      case 'result': {
        console.log('\n--- loop stopped ---');
        console.log(`  [result] ${message.subtype}`);
        break;
      }
      default:
        break;
    }
  }

  console.log('\n--- oversight trace (the auto-vs-ask boundary, made legible) ---');
  console.log(formatDecisionLog());
  console.log(`\n(structured decision log available via getDecisionLog() — ${getDecisionLog().length} entrie(s) — for Phase 4's UI.)`);
}

main().catch((err) => {
  console.error('Phase 3 agent failed:', err);
  process.exit(1);
});
