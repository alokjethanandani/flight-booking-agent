/**
 * Phase 3 — oversight gate routing tests (the auto-vs-ask boundary).
 *
 * These prove the centerpiece deterministically, offline: given a mode + a
 * classification, does the gate allow / deny / escalate correctly, and does it
 * consume human input only when it should? No SDK, no network, no live model.
 *
 * The gate is typed as the SDK's CanUseTool (3-arg). We only exercise the first
 * two args, so we cast to a 2-arg callable to avoid building the full options
 * envelope — the gate implementation ignores the third arg.
 *
 * Run via `npm test`. node:assert only, matching the other test files.
 */

import assert from 'node:assert/strict';
import { classifyOffers } from './rank-offers.js';
import type { Constraints } from './constraints.js';
import { buildDemoOffers } from './demo-fixtures.js';
import {
  createOversightGate,
  recordClassification,
  getDecisionLog,
  _resetOversight,
  type Mode,
} from './oversight.js';
import { createAnswerProvider } from './prompt-io.js';

type SimpleGate = (
  toolName: string,
  input: Record<string, unknown>,
) => Promise<{ behavior: string; updatedInput?: Record<string, unknown>; message?: string } | null>;

const BOOK = 'mcp__phase3__book_flight';

// Constraint sets tuned to the fixtures (see demo-fixtures.ts).
const LOOSE: Constraints = { maxPrice: 650, currency: 'USD', maxStops: 0, maxTotalDurationMinutes: 720, preferredAirlines: ['DL'] };
const TIGHT: Constraints = { maxPrice: 420, currency: 'USD', maxStops: 0, maxTotalDurationMinutes: 720, preferredAirlines: ['DL'] };

function gateFor(mode: Mode, scripted?: string[]): SimpleGate {
  return createOversightGate({ mode, answers: createAnswerProvider(scripted) }) as unknown as SimpleGate;
}

let passed = 0;
let failed = 0;
async function test(name: string, fn: () => Promise<void>): Promise<void> {
  _resetOversight();
  try {
    await fn();
    passed += 1;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    failed += 1;
    console.error(`  ✗ ${name}`);
    console.error(`      ${(err as Error).message}`);
  }
}

async function run() {
  console.log('\n--- Phase 3 oversight gate tests ---\n');

  await test('AUTOMATED + eligible → allow, no human consulted', async () => {
    recordClassification(classifyOffers(buildDemoOffers(), LOOSE));
    const answers = ['SHOULD_NOT_BE_USED'];
    const gate = gateFor('automated', answers);
    const r = await gate(BOOK, { offerId: 'off_aa_direct', passengerCount: 1 });
    assert.equal(r?.behavior, 'allow');
    // The scripted answer must be untouched — automated eligible never asks.
    const log = getDecisionLog();
    assert.equal(log[0]?.action, 'auto-book');
    assert.equal(log[0]?.humanAnswer, undefined);
  });

  await test('AUTOMATED + tolerance + human "y" → allow (escalation approved)', async () => {
    recordClassification(classifyOffers(buildDemoOffers(), TIGHT));
    const gate = gateFor('automated', ['y']);
    const r = await gate(BOOK, { offerId: 'off_aa_direct' }); // AA is the tolerance option
    assert.equal(r?.behavior, 'allow');
    assert.equal(getDecisionLog()[0]?.action, 'escalated-approved');
  });

  await test('AUTOMATED + tolerance + human "n" → deny (escalation declined)', async () => {
    recordClassification(classifyOffers(buildDemoOffers(), TIGHT));
    const gate = gateFor('automated', ['n']);
    const r = await gate(BOOK, { offerId: 'off_aa_direct' });
    assert.equal(r?.behavior, 'deny');
    assert.equal(getDecisionLog()[0]?.action, 'escalated-declined');
  });

  await test('AUTOMATED + rejected → deny, no human consulted', async () => {
    recordClassification(classifyOffers(buildDemoOffers(), LOOSE));
    const gate = gateFor('automated', ['SHOULD_NOT_BE_USED']);
    const r = await gate(BOOK, { offerId: 'off_dl_1stop' }); // 1 stop → rejected (direct only)
    assert.equal(r?.behavior, 'deny');
    assert.equal(getDecisionLog()[0]?.action, 'blocked-rejected');
    assert.equal(getDecisionLog()[0]?.humanAnswer, undefined);
  });

  await test('unknown offerId → deny (not in ranked set)', async () => {
    recordClassification(classifyOffers(buildDemoOffers(), LOOSE));
    const gate = gateFor('automated');
    const r = await gate(BOOK, { offerId: 'off_does_not_exist' });
    assert.equal(r?.behavior, 'deny');
    assert.equal(getDecisionLog()[0]?.action, 'blocked-unknown');
  });

  await test('HITL + eligible + "y" → allow (human approved)', async () => {
    recordClassification(classifyOffers(buildDemoOffers(), LOOSE));
    const gate = gateFor('hitl', ['y']);
    const r = await gate(BOOK, { offerId: 'off_dl_direct' });
    assert.equal(r?.behavior, 'allow');
    assert.equal(getDecisionLog()[0]?.action, 'hitl-approved');
  });

  await test('HITL + eligible + "n" → deny (human declined)', async () => {
    recordClassification(classifyOffers(buildDemoOffers(), LOOSE));
    const gate = gateFor('hitl', ['n']);
    const r = await gate(BOOK, { offerId: 'off_dl_direct' });
    assert.equal(r?.behavior, 'deny');
    assert.equal(getDecisionLog()[0]?.action, 'hitl-declined');
  });

  await test('HITL reselection by number → allow with rewritten offerId (human override)', async () => {
    const classified = classifyOffers(buildDemoOffers(), LOOSE);
    recordClassification(classified);
    // Eligible order is price-asc: [aa 498, dl 520, b6 610]. Agent proposes #1
    // (aa); human types "2" to override to dl.
    const selectableIds = [...classified.eligible, ...classified.tolerance].map((e) => e.offer.id);
    const gate = gateFor('hitl', ['2']);
    const r = await gate(BOOK, { offerId: selectableIds[0]!, passengerCount: 1 });
    assert.equal(r?.behavior, 'allow');
    assert.equal(r?.updatedInput?.offerId, selectableIds[1]);
    const log = getDecisionLog()[0];
    assert.equal(log?.action, 'hitl-approved');
    assert.equal(log?.finalOfferId, selectableIds[1]);
  });

  await test('HITL + rejected → deny even with human present (hard fail line)', async () => {
    recordClassification(classifyOffers(buildDemoOffers(), LOOSE));
    const gate = gateFor('hitl', ['y']);
    const r = await gate(BOOK, { offerId: 'off_wn_2stop' }); // 2 stops → rejected
    assert.equal(r?.behavior, 'deny');
    assert.equal(getDecisionLog()[0]?.action, 'blocked-rejected');
  });

  await test('non-book tool → allow (gate only guards book_flight)', async () => {
    recordClassification(classifyOffers(buildDemoOffers(), LOOSE));
    const gate = gateFor('automated');
    const r = await gate('mcp__phase3__search_flights', { origin: 'AUS' });
    assert.equal(r?.behavior, 'allow');
    assert.equal(getDecisionLog().length, 0); // non-book tools aren't logged as decisions
  });

  console.log(`\n--- ${passed} passed, ${failed} failed ---\n`);
  if (failed > 0) process.exit(1);
}

run();
