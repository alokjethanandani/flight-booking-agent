/**
 * Phase 2 — constraints + ranking (PRD §7).
 *
 * Adds a second tool, `rank_offers`, alongside Phase 1's `search_flights`.
 * The design centerpiece (PRD §8) is the split:
 *
 *   - DETERMINISTIC CODE (rank_offers → classifyOffers) enforces the trust
 *     boundary: hard stops/duration filters + a three-tier budget gate
 *     (within / within-20%-tolerance / rejected). Testable, correct-by-
 *     construction. This is what makes "I paused because it's past your
 *     tolerance" reliable rather than a vibe.
 *   - AGENT-REASONED ORDERING (this loop's system prompt) turns the eligible
 *     tier into a preferred pick + secondary options, explaining *why* in
 *     natural language, weighing the soft preferred-airline signal.
 *
 * Still no booking (Phase 3) and no UI (Phase 4). `book_flight` does not
 * exist yet — the mock boundary holds trivially. Run: `npm run phase2`.
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
import { saveSearchResult, getSearchResult } from './lib/offer-store.js';
import { classifyOffers } from './lib/rank-offers.js';
import type { Constraints } from './lib/constraints.js';
import {
  printClassifiedOffers,
  formatClassifiedOffers,
} from './lib/print-classified.js';

function describeSearchError(err: unknown): { console: string; model: string } {
  if (err instanceof DuffelError) {
    const status = err.meta?.status;
    const details =
      err.errors?.map((e) => `${e.code}: ${e.message}`).join('; ') ??
      err.message;
    return {
      console: `Duffel API error (HTTP ${status}): ${details}`,
      model: `The Duffel search failed (HTTP ${status}): ${details}. Do not guess at flight data — report this error to the user.`,
    };
  }
  if (err instanceof Error) {
    return {
      console: `${err.name}: ${err.message}${err.stack ? `\n${err.stack}` : ''}`,
      model: `The search_flights tool failed with an unexpected error: ${err.message}. Do not guess at flight data — report this error to the user.`,
    };
  }
  return {
    console: String(err),
    model: `The search_flights tool failed with an unexpected error: ${String(err)}. Do not guess at flight data — report this error to the user.`,
  };
}

// --- Tool 1: search_flights (as Phase 1, plus it stashes results) ----------

const searchFlightsTool = tool(
  'search_flights',
  'Search real flight offers via Duffel for a one-way or round-trip. ' +
    'Returns a searchId and a price-sorted summary. Call rank_offers next to ' +
    'apply the user\'s constraints.',
  {
    origin: z.string().describe('Origin airport IATA code, e.g. "AUS"'),
    destination: z.string().describe('Destination airport IATA code, e.g. "JFK"'),
    departureDate: z.string().describe('Departure date, ISO 8601 (YYYY-MM-DD)'),
    returnDate: z
      .string()
      .optional()
      .describe('Return date, ISO 8601 (YYYY-MM-DD). Omit for one-way.'),
    passengerCount: z
      .number()
      .int()
      .min(1)
      .default(1)
      .describe('Number of adult passengers. v1 only supports adults.'),
    cabinClass: z
      .enum(['first', 'business', 'premium_economy', 'economy'])
      .default('economy')
      .describe('Cabin class to search in.'),
  },
  async ({
    origin,
    destination,
    departureDate,
    returnDate,
    passengerCount,
    cabinClass,
  }) => {
    console.log(
      `  [tool executing] search_flights(${origin} -> ${destination}, depart ${departureDate}` +
        `${returnDate ? `, return ${returnDate}` : ' (one-way)'}, ` +
        `${passengerCount} adult(s), ${cabinClass})`,
    );

    try {
      const offers = await searchFlights(
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
                : `searchId: ${searchId}\n${offers.length} offer(s) found, sorted by price ascending (showing up to 10):\n\n${summaryForModel}\n\nNow call rank_offers with searchId "${searchId}" and the user's constraints.`,
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

// --- Tool 2: rank_offers (deterministic gating) ----------------------------

const rankOffersTool = tool(
  'rank_offers',
  'Apply the user\'s constraints to a completed search and sort offers into ' +
    'eligible / tolerance / rejected tiers. Deterministic: stops and duration ' +
    'are hard filters; budget has a tolerance band. Returns the gated tiers ' +
    'for YOU to then order into a preferred pick + secondary options.',
  {
    searchId: z
      .string()
      .optional()
      .describe('The searchId from search_flights. Omit to use the latest search.'),
    maxPrice: z
      .number()
      .optional()
      .describe('Max total trip price (all passengers), in the budget currency.'),
    currency: z
      .string()
      .optional()
      .describe('Currency of the budget, e.g. "USD". No FX conversion in v1.'),
    maxStops: z
      .number()
      .int()
      .min(0)
      .optional()
      .describe('Max connections on the worst slice (0 = direct only). Hard filter.'),
    maxTotalDurationMinutes: z
      .number()
      .int()
      .min(0)
      .optional()
      .describe('Max total trip duration in minutes. Hard filter.'),
    preferredAirlines: z
      .array(z.string())
      .optional()
      .describe('Preferred airline IATA codes, e.g. ["DL","AA"]. SOFT: never eliminates.'),
    budgetTolerancePct: z
      .number()
      .min(0)
      .optional()
      .describe('Over-budget tolerance (0.20 = 20%). Defaults to 0.20 if omitted.'),
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

    console.log(
      `  [tool executing] rank_offers(${found.searchId}, ${JSON.stringify(constraints)})`,
    );

    const classified = classifyOffers(found.offers, constraints);
    printClassifiedOffers(classified);

    const guidance =
      '\n\nUsing the ELIGIBLE tier, choose ONE preferred offer and up to 3 ' +
      'secondary options, and explain briefly why the preferred one wins ' +
      '(price, duration, stops, preferred-airline). If ELIGIBLE is empty but ' +
      'TOLERANCE has offers, do NOT present them as bookable — surface the ' +
      'closest one as an escalation ("$X / Y% over your budget; everything ' +
      'else is met") and ask the user. If everything is rejected, say why.';

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

// --- Register + run ---------------------------------------------------------

const phase2Server = createSdkMcpServer({
  name: 'phase2-flight-ranking',
  version: '0.1.0',
  tools: [searchFlightsTool, rankOffersTool],
});

async function main() {
  console.log('--- preflight ---');
  await runPreflightChecks({ duffelEnv: 'prod' });

  // Hardcoded demo trip + constraints for Phase 2. Swap to try other cases —
  // e.g. tighten maxPrice so the only options fall in the tolerance band and
  // watch the agent escalate instead of recommending a booking.
  const prompt =
    'Find me a round-trip flight from Austin (AUS) to New York (JFK), ' +
    'departing 2026-09-14 and returning 2026-09-18, for 2 adults in economy. ' +
    'My constraints: budget 1200 USD total, direct flights only (0 stops), ' +
    'max total duration 12 hours (720 minutes), and I prefer Delta (DL). ' +
    'Search, then rank against those constraints, then give me a preferred ' +
    'pick and secondary options with your reasoning.';

  console.log(`\nPrompt: ${prompt}\n`);
  console.log('--- agent loop ---');

  const stream = query({
    prompt,
    options: {
      mcpServers: { phase2: phase2Server },
      allowedTools: ['mcp__phase2__search_flights', 'mcp__phase2__rank_offers'],
      systemPrompt:
        'You are the Phase 2 agent for a flight-booking POC. You have two ' +
        'tools: search_flights (real Duffel search) and rank_offers ' +
        '(deterministic constraint gating). Workflow: call search_flights, ' +
        'then rank_offers with the searchId and the user\'s constraints, then ' +
        'present a PREFERRED pick and SECONDARY options drawn only from the ' +
        'ELIGIBLE tier, explaining why the preferred one wins. Treat the ' +
        'TOLERANCE tier as escalation candidates, never as auto-bookable. ' +
        'Never invent flight data — rely only on the tools. You cannot book ' +
        'anything in this phase.',
    },
  });

  for await (const message of stream as AsyncIterable<SDKMessage>) {
    switch (message.type) {
      case 'assistant': {
        for (const block of message.message.content) {
          if (block.type === 'text') {
            console.log(`  [assistant] ${block.text}`);
          } else if (block.type === 'tool_use') {
            console.log(
              `  [assistant -> tool_use] ${block.name}(${JSON.stringify(block.input)})`,
            );
          }
        }
        break;
      }
      case 'result': {
        console.log('--- loop stopped ---');
        console.log(`  [result] ${message.subtype}`);
        break;
      }
      default:
        break;
    }
  }
}

main().catch((err) => {
  console.error('Phase 2 agent failed:', err);
  process.exit(1);
});
