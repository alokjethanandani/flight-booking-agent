/**
 * Phase 1 — real search (PRD §7).
 *
 * Replaces Phase 0's dummy `get_weather` tool with a real `search_flights`
 * tool backed by Duffel. Same loop shape as Phase 0: tool definition ->
 * model calls it -> we execute (real Duffel offer request this time) ->
 * result feeds back -> model summarizes -> loop stops.
 *
 * Still no constraint filtering/ranking (Phase 2) and no UI (Phase 4) — the
 * tool itself prints the price-sorted offer list straight to the terminal
 * when it executes, which is what PRD §7 Phase 1 asks for.
 *
 * `search_flights` always searches on the PRODUCTION Duffel environment
 * (locked PRD §9/§10 decision) — see src/lib/duffel-client.ts for why.
 *
 * Run: `npm run phase1` (requires ANTHROPIC_API_KEY and DUFFEL_API_KEY_PROD
 * in your environment or .env)
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

/**
 * Formats an error into (a) a detailed console line for local debugging and
 * (b) a short, honest message for the model — so a Duffel failure surfaces
 * as an actual reason, not a silent "no data, try again."
 */
function describeSearchError(err: unknown): { console: string; model: string } {
  if (err instanceof DuffelError) {
    const status = err.meta?.status;
    const details = err.errors
      ?.map((e) => `${e.code}: ${e.message}`)
      .join('; ') ?? err.message;
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

// --- 1. Define the real search_flights tool --------------------------------

const searchFlightsTool = tool(
  'search_flights',
  'Search real flight offers via Duffel for a one-way or round-trip. ' +
    'Always uses live production data, sorted by price ascending.',
  {
    origin: z.string().describe('Origin airport IATA code, e.g. "AUS"'),
    destination: z
      .string()
      .describe('Destination airport IATA code, e.g. "JFK"'),
    departureDate: z
      .string()
      .describe('Departure date, ISO 8601 (YYYY-MM-DD)'),
    returnDate: z
      .string()
      .optional()
      .describe(
        'Return date, ISO 8601 (YYYY-MM-DD). Omit for a one-way search.',
      ),
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
        {
          origin,
          destination,
          departureDate,
          returnDate,
          passengerCount,
          cabinClass,
        },
        'prod',
      );

      // Terminal print — the Phase 1 deliverable per PRD §7.
      printRankedOffers(offers);

      // Feed a compact text summary back to the model (full precision, but
      // capped so a large result set doesn't blow the context).
      const summaryForModel = formatOffersTable(offers.slice(0, 10));

      return {
        content: [
          {
            type: 'text' as const,
            text:
              offers.length === 0
                ? 'No offers found for this search.'
                : `${offers.length} offer(s) found, sorted by price ascending (showing up to 10):\n\n${summaryForModel}`,
          },
        ],
      };
    } catch (err) {
      const { console: consoleMsg, model: modelMsg } = describeSearchError(err);
      console.error(`  [tool error] ${consoleMsg}`);
      return {
        isError: true,
        content: [{ type: 'text' as const, text: modelMsg }],
      };
    }
  },
);

// --- 2. Register the tool as an in-process MCP server ---------------------

const phase1Server = createSdkMcpServer({
  name: 'phase1-flight-search',
  version: '0.1.0',
  tools: [searchFlightsTool],
});

// --- 3. Run the agent loop --------------------------------------------------

async function main() {
  console.log('--- preflight ---');
  await runPreflightChecks({ duffelEnv: 'prod' });

  // Hardcoded demo trip for Phase 1 — no NL intake / UI yet (that's Phase 4).
  // Swap these details to try a different route.
  const prompt =
    'Find me a round-trip flight from Austin (AUS) to New York (JFK), ' +
    'departing 2026-09-14 and returning 2026-09-18, for 2 adults in economy. ' +
    "Use the tool, don't guess, then summarize the top 3 cheapest options " +
    'with airline and total price.';

  console.log(`\nPrompt: ${prompt}\n`);
  console.log('--- agent loop ---');

  const stream = query({
    prompt,
    options: {
      mcpServers: {
        phase1: phase1Server,
      },
      allowedTools: ['mcp__phase1__search_flights'],
      systemPrompt:
        'You are a minimal test agent for Phase 1 of a flight-booking-agent POC. ' +
        'You have exactly one tool, search_flights. Use it when relevant, then give ' +
        'a short final answer summarizing the results.',
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
  console.error('Phase 1 agent failed:', err);
  process.exit(1);
});
