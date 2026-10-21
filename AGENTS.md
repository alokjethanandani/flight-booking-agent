# Project Instructions — Consumer Flight-Booking Agent

Governs how Codex works in this project across design, build, test, and launch. Source of truth for scope/architecture is `Mini-PRD-Flight-Booking-Agent.md` — read it before major decisions. If it's silent on something, ask; don't guess.

## 1. Non-negotiable guardrails

- **`book_flight` is always mocked.** No code path may ever call Duffel's paid `order` endpoint. A live Duffel token is for search only. Before marking any booking-related work done, verify (grep/test) that no real order call is reachable.
- **No real payment, ticketing, or PNRs.** Ever, even for testing.
- **No BILL IP** in this project — wholly independent domain.
- **Reversibility check:** before anything destructive or hard-to-undo (deleting files, force-pushing, rewriting the PRD's locked decisions, spending non-trivial API credits, publishing content externally) — show the plan, flag what's irreversible, wait for explicit "proceed."

## 2. Scope discipline

v1 scope and non-goals are fixed in PRD §3. Non-goals: real payment/ticketing, hotels, cars, multi-city, loyalty/points, seat selection, accounts/production auth, the B2B "policy mode" variant.

If a request would add any of these — say so explicitly ("this is scope creep per the PRD non-goals") and require an explicit override before proceeding. Don't quietly absorb scope expansion.

## 3. Build workflow

Follow the phased plan in PRD §7 (Phase 0 → 5) in order. Don't jump ahead to a later phase without a working, demoable result from the current one.

At the end of each phase: recap what was built, confirm it's demoable, get a lightweight go-ahead before starting the next phase.

If Alok says scope or constraints changed mid-phase, stop and re-confirm the affected PRD sections before writing more code — don't assume the old constraints still hold.

## 4. Locked technical decisions (PRD §10)

TypeScript end-to-end · Codex Agent SDK · Duffel TS client (`@duffel/api`) · UI in v0/Lovable · one-way + round-trip only.

Treat these as settled. If one looks wrong once you're in the code, flag it and explain why — don't silently deviate.

## 5. Testing bar

Each phase's "done" = demoable end-to-end, not production-hardened (per PRD success criteria — this is a POC, not a shipped product). Still, for anything touching the booking path, prove the mock boundary holds — that's the one guardrail that isn't optional.

## 6. Working style

- Show reasoning for ranking/scoring logic and automated-vs-escalate routing — that logic *is* the point of the project (PRD §8).
- No sycophancy: if a shortcut undermines the oversight-legibility goal (the auto-vs-ask boundary being visible and explainable), say so instead of shipping it quietly.
- Keep a running `BUILD-LOG.md` in this folder — decisions made, what's done, open questions. Update it at the end of each session or phase so context survives across sessions.

## 7. Launch/demo bar

"Done" means: both modes (automated + HITL) work end-to-end, the oversight model is visible in the UI, constraints are configurable, mock confirmations render correctly, and there is no reachable path to a real Duffel order call. Screen-recordable is the actual finish line — not feature completeness.

## 8. Development commands

```
npm install                    # install deps
npm run phase0                 # Phase 0 — hello-world agent, one dummy tool
npm run phase1                 # Phase 1 — real Duffel search, price-sorted terminal print
npm run phase2                 # Phase 2 — search + constraint gate + agent ordering
npm run phase3:hitl            # Phase 3 — human-in-the-loop mode (real search)
npm run phase3:auto            # Phase 3 — automated mode (real search)
npm test                       # runs rank-offers, book-flight, oversight test suites
npm run typecheck              # tsc --noEmit (also aliased as `npm run build`)
```

Phase 3 CLI flags (see `src/phase3-two-modes.ts` header for the full list):
- `--mode=automated|hitl` — overrides the npm script default
- `--scenario=autobook|escalate` — tunes the demo prompt's budget to land in the eligible vs. tolerance tier
- `--offline` — swaps in fixed fixtures from `demo-fixtures.ts` (no Duffel call, reproducible)
- `--answers="y;n;3"` — scripted replies for the gate's human prompts / `ask_user`, for non-interactive recordings

## 9. Environment setup

- Node 18+, TypeScript throughout (`tsconfig.json`: `NodeNext` module/resolution, `strict: true`).
- Copy `.env.example` to `.env` (gitignored) and fill in:
  - `ANTHROPIC_API_KEY` — required from Phase 0 on; powers the Codex Agent SDK loop.
  - `DUFFEL_API_KEY_PROD` — required from Phase 1 on. This is the **only** key `search_flights` uses at runtime (locked PRD §9/§10 decision: production data, not single-airline test mode).
  - `DUFFEL_API_KEY_TEST` — optional, for local smoke-testing the Duffel wiring only. Never used by the tool the agent actually calls.
- Neither key is ever pasted into chat — set them directly in `.env` on your own machine.
- `src/lib/preflight.ts` fail-fasts before the agent loop starts: validates `ANTHROPIC_API_KEY` via a free `GET /v1/models` call (missing / malformed / network / 401 / 403 all get distinct messages) and checks `DUFFEL_API_KEY_PROD`/`_TEST` presence + prefix (`duffel_live_...` / `duffel_test_...`) without a network call.

## 10. Architecture & code layout

Each phase has one runnable entrypoint at `src/phaseN-*.ts` that wires tools into a `query()` loop via `createSdkMcpServer`; shared logic lives in `src/lib/`.

```
src/
  phase0-hello-world.ts     Phase 0 — one dummy tool, proves the loop
  phase1-search-flights.ts  Phase 1 — search_flights only
  phase2-rank-flights.ts    Phase 2 — + rank_offers
  phase3-two-modes.ts       Phase 3 — + book_flight (MOCK) + ask_user; canUseTool gate wired in
  lib/
    duffel-client.ts        env-aware Duffel client factory (prod/test token selection)
    search-flights.ts       builds offer_request slices, calls Duffel, sorts price-ascending
    normalize-offer.ts      raw Duffel Offer -> NormalizedOffer/Slice/Segment (ISO-8601 duration parsed)
    offer-store.ts          in-process store: search_flights stashes full offers, hands the model
                             a searchId; rank_offers/book_flight look up full-fidelity offers by id
    constraints.ts          Constraints type (budget/stops/duration/preferred airlines) + tolerance default
    rank-offers.ts          the deterministic gate: classifyOffers/evaluateOffer ->
                             eligible / tolerance / rejected tiers
    oversight.ts            the canUseTool permission gate — the auto-vs-ask trust boundary — plus
                             the structured OversightDecision log
    book-flight.ts          the MOCK booking action; imports nothing from @duffel/api
    prompt-io.ts            AnswerProvider — real stdin or scripted (--answers) human input
    demo-fixtures.ts        fixed offline offers for reproducible demo recordings (--offline)
    preflight.ts            fail-fast credential checks (see §9)
    print-offers.ts         terminal rendering of ranked offers (Phase 1)
    print-classified.ts     terminal rendering of eligible/tolerance/rejected tiers (Phase 2+)
  *.test.ts                 offline unit tests, colocated with the module under test
```

## 11. Key design patterns

- **The trust boundary lives in code, not the prompt.** `book_flight` is deliberately left out of `allowedTools` in `phase3-two-modes.ts`, so every booking attempt is forced through `canUseTool` (`oversight.ts`) before it can execute — a runtime guarantee, not something contingent on the model choosing to ask.
- **Deterministic gate, agent-reasoned ordering.** Constraint enforcement (`rank-offers.ts`) is pure, testable code — an LLM can't be trusted to reproducibly enforce a numeric boundary like the 20% budget tolerance. The agent only orders the *already-gated* survivors into a preferred pick + secondaries and narrates why. Guardrail correct-by-construction; explanation agent-reasoned.
- **Three-tier classification**, not a binary pass/fail: `eligible` (books freely), `tolerance` (over budget by ≤20% with all other hard constraints met — an escalation candidate, never auto-bookable), `rejected` (hard rule broken, or >20% over). Conservative on missing data (e.g. unknown duration against a duration constraint → rejected, not assumed-fine).
- **Full-fidelity offers never round-trip through the model.** `search_flights` returns the model a `searchId` + text summary only; `offer-store.ts` holds the real `NormalizedOffer[]`. `rank_offers` and `book_flight` look offers up by id, so the trust boundary always evaluates genuine data, never a model paraphrase.
- **Mode routing is symmetric on the two "unsafe" tiers.** AUTOMATED: eligible → allow silently, tolerance → pause and ask, rejected/unknown → deny. HITL: eligible/tolerance → always pause for explicit approval (with reselection support), rejected/unknown → deny even if a human would approve (POC line — no override of hard rejects in v1).
- **Scripted human input for reproducible demos.** `prompt-io.ts`'s `AnswerProvider` abstracts real stdin vs. a `--answers="y;n"` queue, so both the oversight gate's prompts and the `ask_user` tool can be driven non-interactively for recordings.
- **The mock boundary is enforced twice.** Behaviorally (`bookFlight()` fabricates a confirmation, checks only offer expiry) and statically (`book-flight.test.ts` scans `book-flight.ts`'s actual source, comments stripped, for any `@duffel/api` import or `.orders`/`orders.create`/`/air/orders`/`createOrder` reference) — see §14.

## 12. Technology notes

| Library | Version | Purpose |
|---|---|---|
| `@anthropic-ai/Codex-agent-sdk` | ^0.3.201 | The agent loop itself — `query()`, `tool()`, `createSdkMcpServer()`, and the `canUseTool` permission callback that enforces the auto-vs-ask boundary before any tool executes. |
| `@duffel/api` | ^4.28.0 | Duffel's official TS client. Used for exactly one method anywhere in the codebase: `duffel.offerRequests.create` (flight search). No `.orders`/order-creation call is wired to any tool — that's the non-negotiable guardrail (§1, §14). |
| `zod` | ^4.0.0 | Tool input schemas passed to `tool()`. Pinned to v4 deliberately — the Agent SDK's peer dependency requires v4, not v3 (v3 causes an `ERESOLVE` conflict on install; a lot of zod examples online still assume v3 syntax). |
| `dotenv` | ^16.4.0 | Loads `.env` into `process.env`; imported as `import 'dotenv/config'` as the first import in each phase entrypoint. |
| `tsx` | ^4.19.0 | Runs `.ts` entrypoints directly (`npm run phaseN`) without a separate build step. |
| `typescript` | ^5.6.0 | Strict typechecking (`npm run typecheck`); `NodeNext` module resolution throughout. |

## 13. Progress status

Full session-by-session history, decisions, and open questions: `BUILD-LOG.md`. Summary as of 2026-07-20 (update this table at the end of each phase, per §3/§6):

| Phase | Status | Notes |
|---|---|---|
| 0 — Setup | **Done** | Hello-world agent + dummy tool confirmed end-to-end on Alok's machine. |
| 1 — Real search | **Done** | `search_flights` confirmed against production Duffel (220 real offers, AUS→JFK round-trip); agent correctly declines to guess when the tool errors. |
| 2 — Constraints + ranking | **Done** | Deterministic gate (`rank-offers.ts`) built and offline-tested (14/14); full live loop verified as part of Phase 3 below. |
| 3 — Two modes (automated + HITL) | **Done** | `canUseTool` oversight gate built; 29/29 tests pass (gate + mock-boundary + oversight-routing), all routing branches covered offline. This is the design centerpiece per PRD §8. |
| 4 — Thin UI + settings (hand-built in-repo) | **Done** | Vite/React/Tailwind/shadcn SPA + Express/SSE bridge, wired to a Codex Design prototype's exact tokens/interaction model. Verified live in-browser against production Duffel + the live model: HITL happy path + reselection, `ask_user` free text, real empty state, automated auto-book, automated escalation (the hero interaction) with the decision reason rendered verbatim. §14 re-passed including the added server-level check; 29/29 tests. |
| 5 — Demo + content | **Not started** | Screen recordings + digest + LinkedIn posts. |

## 14. Mock boundary verification

Before marking any booking-related work done, confirm no code path can reach Duffel's paid `order` endpoint:

1. `grep -rn "orders\.\|orders\.create\|/air/orders\|createOrder" src/` — the only hit should be the forbidden-pattern list inside `book-flight.test.ts`; nothing in executable code.
2. `grep -n "from '@duffel/api'" src/lib/book-flight.ts` — should return nothing (the file's own guardrail comment mentions the package name in prose, which is expected and harmless; only an actual `import`/`require` statement matters).
3. `npm test` — runs `book-flight.test.ts`, which statically self-scans `book-flight.ts`'s source (comments stripped) for a `@duffel/api` import or any `.orders`/`orders.create`/`/air/orders`/`createOrder` reference, plus behavioral tests of `bookFlight()`'s fabricated-confirmation and offer-expiry paths.
4. Confirm the only Duffel client method invoked anywhere in `src/` is `duffel.offerRequests.create` (in `search-flights.ts`) — search only, never order creation.

Re-run this check any time `book-flight.ts`, `duffel-client.ts`, `oversight.ts`, or the tool wiring in a `phaseN-*.ts` entrypoint changes.

## Imported Claude Cowork project instructions

# Project Instructions — Consumer Flight-Booking Agent

Governs how Claude works in this project across design, build, test, and launch. Source of truth for scope/architecture is `Mini-PRD-Flight-Booking-Agent.md` — read it before major decisions. If it's silent on something, ask; don't guess.

## 1. Non-negotiable guardrails

- **`book_flight` is always mocked.** No code path may ever call Duffel's paid `order` endpoint. A live Duffel token is for search only. Before marking any booking-related work done, verify (grep/test) that no real order call is reachable.
- **No real payment, ticketing, or PNRs.** Ever, even for testing.
- **No BILL IP** in this project — wholly independent domain.
- **Reversibility check:** before anything destructive or hard-to-undo (deleting files, force-pushing, rewriting the PRD's locked decisions, spending non-trivial API credits, publishing content externally) — show the plan, flag what's irreversible, wait for explicit "proceed."

## 2. Scope discipline

v1 scope and non-goals are fixed in PRD §3. Non-goals: real payment/ticketing, hotels, cars, multi-city, loyalty/points, seat selection, accounts/production auth, the B2B "policy mode" variant.

If a request would add any of these — say so explicitly ("this is scope creep per the PRD non-goals") and require an explicit override before proceeding. Don't quietly absorb scope expansion.

## 3. Build workflow

Follow the phased plan in PRD §7 (Phase 0 → 5) in order. Don't jump ahead to a later phase without a working, demoable result from the current one.

At the end of each phase: recap what was built, confirm it's demoable, get a lightweight go-ahead before starting the next phase.

If Alok says scope or constraints changed mid-phase, stop and re-confirm the affected PRD sections before writing more code — don't assume the old constraints still hold.

## 4. Locked technical decisions (PRD §10)

TypeScript end-to-end · Claude Agent SDK · Duffel TS client (`@duffel/api`) · UI in v0/Lovable · one-way + round-trip only.

Treat these as settled. If one looks wrong once you're in the code, flag it and explain why — don't silently deviate.

## 5. Testing bar

Each phase's "done" = demoable end-to-end, not production-hardened (per PRD success criteria — this is a POC, not a shipped product). Still, for anything touching the booking path, prove the mock boundary holds — that's the one guardrail that isn't optional.

## 6. Working style

- Show reasoning for ranking/scoring logic and automated-vs-escalate routing — that logic *is* the point of the project (PRD §8).
- No sycophancy: if a shortcut undermines the oversight-legibility goal (the auto-vs-ask boundary being visible and explainable), say so instead of shipping it quietly.
- Keep a running `BUILD-LOG.md` in this folder — decisions made, what's done, open questions. Update it at the end of each session or phase so context survives across sessions.

## 7. Launch/demo bar

"Done" means: both modes (automated + HITL) work end-to-end, the oversight model is visible in the UI, constraints are configurable, mock confirmations render correctly, and there is no reachable path to a real Duffel order call. Screen-recordable is the actual finish line — not feature completeness.
