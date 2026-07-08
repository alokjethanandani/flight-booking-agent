/**
 * Phase 0 — hello-world agent with one dummy tool.
 *
 * Goal (per Mini-PRD §6/§7 "learn-then-build ramp"): see the agent loop with
 * your own eyes before wiring in anything real —
 *
 *   tool definition  →  model decides to call it  →  we execute it  →
 *   result goes back to the model  →  loop  →  model stops when satisfied.
 *
 * No Duffel, no booking, no ranking logic here. Just one fake tool
 * (`get_weather`) so the loop has something to reach for. Everything below
 * is throwaway scaffolding for Phase 0 — Phase 1 replaces `get_weather`
 * with `search_flights` against Duffel.
 *
 * Run: `npm run phase0` (requires ANTHROPIC_API_KEY in your environment or .env)
 */

// Load .env into process.env before anything else touches ANTHROPIC_API_KEY.
// Without this, a filled-in .env is silently ignored and the underlying CLI
// falls back to checking for an interactive login, producing a confusing
// "Not logged in · Please run /login" error even though the key is set.
import 'dotenv/config';

import { z } from 'zod';
import {
  query,
  tool,
  createSdkMcpServer,
  type SDKMessage,
} from '@anthropic-ai/claude-agent-sdk';
import { runPreflightChecks } from './lib/preflight.js';

// --- 1. Define one dummy tool ---------------------------------------------
//
// A real tool would call an API (Duffel search, in Phase 1). This one just
// returns canned data so we can watch the model decide to call it, see the
// result come back, and use it in its final answer.

const getWeather = tool(
  'get_weather',
  'Get the current (fake) weather for a city. Dummy data for Phase 0 — proves the tool-use loop works before any real integration.',
  {
    city: z.string().describe('City name, e.g. "Austin"'),
  },
  async ({ city }) => {
    console.log(`  [tool executing] get_weather(city=${city})`);
    const fakeReport = `${city}: 72°F, clear skies. (fake data — Phase 0 dummy tool)`;
    return {
      content: [{ type: 'text', text: fakeReport }],
    };
  },
);

// --- 2. Register the tool as an in-process MCP server ---------------------

const phase0Server = createSdkMcpServer({
  name: 'phase0-dummy-tools',
  version: '0.1.0',
  tools: [getWeather],
});

// --- 3. Run the agent loop --------------------------------------------------

async function main() {
  // Fail fast on a bad/missing ANTHROPIC_API_KEY instead of letting the SDK's
  // silent ~40s retry-then-"Not logged in" behavior masquerade as a hang.
  console.log('--- preflight ---');
  await runPreflightChecks();

  const prompt =
    "What's the weather like in Austin right now? Use the tool, don't guess.";

  console.log(`\nPrompt: ${prompt}\n`);
  console.log('--- agent loop ---');

  const stream = query({
    prompt,
    options: {
      mcpServers: {
        phase0: phase0Server,
      },
      // Only allow our dummy tool — no file/bash access needed for this demo.
      allowedTools: ['mcp__phase0__get_weather'],
      systemPrompt:
        'You are a minimal test agent for Phase 0 of a flight-booking-agent POC. ' +
        'You have exactly one tool. Use it when relevant, then give a short final answer.',
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
        // system/init, stream_event, etc. — ignored for this minimal demo
        break;
    }
  }
}

main().catch((err) => {
  console.error('Phase 0 agent failed:', err);
  process.exit(1);
});
