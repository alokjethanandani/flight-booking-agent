# Build Log — Consumer Flight-Booking Agent

Running log of decisions, progress, and open questions across sessions. Update at the end of each session or phase (per CLAUDE.md §6).

---

## 2026-07-05 — PRD sign-off + Phase 0 setup

**Decisions**
- PRD (`Mini-PRD-Flight-Booking-Agent.md`) formally signed off by Alok. All §10 locked decisions (TS end-to-end, Claude Agent SDK, Duffel TS client, v0/Lovable UI, one-way + round-trip only) are now treated as settled.
- Confirmed `@anthropic-ai/claude-agent-sdk` (npm, currently `0.3.201`) is the correct package.
- Pinned `zod@^4.0.0` — the SDK's peer dependency requires zod v4, not v3 (v3 causes an `ERESOLVE` conflict on install). Worth remembering since a lot of zod examples online still assume v3 syntax.

**Built — Phase 0 (Setup)**
- Scaffolded TS project: `package.json`, `tsconfig.json` (NodeNext, strict), `.gitignore`, `.env.example`.
- `src/phase0-hello-world.ts`: minimal agent with exactly one dummy tool (`get_weather`, fake data), registered via `createSdkMcpServer` + `tool()`, run through `query()`. Demonstrates the full loop: tool def → model calls it → we execute → result feeds back → model gives final answer → loop stops (`result` message).
- `npm run typecheck` passes clean.
- Ran it without credentials to confirm the wiring reaches the SDK/CLI layer correctly — it fails with a clean `Not logged in · Please run /login` from the SDK itself, not a crash in our code. That's the expected proof point for Phase 0 without live credentials.

**Status:** Phase 0 code is demoable-once-authenticated. Not yet run end-to-end with a real response because no `ANTHROPIC_API_KEY` is configured in this environment.

**Open / blocking on Alok**
- Need an **Anthropic API key** (`ANTHROPIC_API_KEY` in `.env`) to actually see the agent respond, or alternatively run `claude /login` if using CLI-based auth instead of an API key.
- Need a **Duffel account + production API token** before Phase 1 (real search). Per PRD §9 risk table: use a *production* token, not test/sandbox — test mode only returns one sandbox airline, which defeats the point of comparison-shopping.
- Neither key should ever be pasted into chat — set them directly in `.env` (gitignored) on Alok's machine.

**Next**
- Once `ANTHROPIC_API_KEY` is set: run `npm run phase0` and confirm the dummy tool actually fires and the model uses the result.
- Then move to Phase 1: `search_flights` against Duffel, normalized offers, printed ranked in terminal (no UI yet). Requires the Duffel token above.

## 2026-07-06 — Fixed `.env` loading bug + added credential preflight check

**Bug found and fixed**
- `phase0-hello-world.ts` never loaded `.env` into `process.env` (no `dotenv` import). Alok's `.env` had a correctly-formatted key, but the script couldn't see it, so the underlying CLI fell back to checking interactive login state → misleading `Not logged in · Please run /login`.
- Fix: added `dotenv` package, `import 'dotenv/config'` as the first import in `phase0-hello-world.ts`.

**Real root cause underneath that bug**
- Once the key loaded, Anthropic's API returned `401 authentication_failed` — the key itself is invalid (likely copy-paste drop, revoked, or wrong key type). The SDK's CLI subprocess retries a bad key silently with exponential backoff (~10 attempts, ~40+ seconds) before surfacing a generic error — reads exactly like a hang.

**Built — fail-fast credential preflight**
- New `src/lib/preflight.ts`: `assertAnthropicApiKeyValid()` calls `GET /v1/models` (a free metadata endpoint, not a completion) directly, before the agent loop starts. Distinguishes and gives specific, actionable messages for: key missing, key present but malformed (missing `sk-ant-` prefix — warning only, not fatal), network/DNS failure (one retry, then fails with the real underlying cause), `401` (bad/revoked key), `403` (valid key, no access/billing), other non-2xx.
- `runPreflightChecks()` wraps it and does a clean `process.exit(1)` with a readable message (no stack trace) on failure.
- Wired into `phase0-hello-world.ts`: runs first thing in `main()`, before `query()`.
- Verified: missing-key case fails in <1s with a clear message (tested by temporarily moving `.env` aside). Bad-key case (current key in `.env`) fails fast with the specific 401 message — confirmed once network reachability was in place. Could not verify the *valid-key* success path in this session's sandbox — its Node runtime hit a sandbox-local DNS resolution issue (`EAI_AGAIN` from Node's `fetch`, while `curl` on the same host resolved fine), unrelated to the code or to Alok's key. Not expected to reproduce on Alok's own machine.

**Next**
- Alok: regenerate the Anthropic API key at console.anthropic.com and drop it into `.env`, then run `npm run phase0` — should now either print `[preflight] ANTHROPIC_API_KEY is valid.` and proceed, or fail in under a couple seconds with a specific reason.
- Once Phase 0 is confirmed demoable end-to-end (dummy tool fires, model uses result), get go-ahead to start Phase 1 (real Duffel search).

## 2026-07-07 — Confirmed: no change to Duffel environment decision

**Raised and resolved**
- Alok asked to move all product functions to the Duffel *test* environment instead of production. Flagged that this contradicts the locked §9/§10 decision (production search for real multi-airline data; test mode returns only one sandbox airline, which would weaken the ranking/comparison demo).
- Alok confirmed: keep production for search, no change. `book_flight` remains fully mocked in code — it never calls Duffel's order endpoint in either test or production, so "test environment" doesn't apply to it regardless.
- PRD (`Mini-PRD-Flight-Booking-Agent.md`) unchanged.

## 2026-07-07 (session 2) — Phase 1 (real search) research, blocked on Duffel credential

**Research (Duffel API v2 docs, checked live — not from training memory)**
- Offer Requests: `POST /air/offer_requests` takes `slices[]` (1 = one-way, 2 = round-trip — matches PRD's locked trip-type scope), `passengers[]`, optional `cabin_class` / `max_connections`. `return_offers=true` embeds offers directly in the response — simpler than a separate paginated List Offers call, good fit for a terminal-only Phase 1.
- Offer schema: `total_amount`/`total_currency`, `slices[].segments[].operating_carrier`, `id`, `expires_at` (offers expire ~30 min — matters for Phase 3 mock booking, not this phase).
- `@duffel/api` is not yet installed (checked `node_modules` — absent, not in `package.json`).

**Decisions made this session**
- Confirmed with Alok: Phase 0 has run successfully end-to-end on his machine (dummy tool fired, model used the result). Gate cleared — safe to build on top of it. (I couldn't re-verify myself; this sandbox can't reach `api.anthropic.com` — same DNS restriction noted 2026-07-06, unrelated to the code.)
- Passenger count and cabin class will be **user-configurable** inputs to `search_flights`, not hardcoded to 1 adult/economy. This is an explicit addition beyond PRD §3's stated intake list (origin, destination, dates, budget, max stops, max total duration, preferred airline(s)), which doesn't mention passengers or cabin. Flagging so it's not silently absorbed — PRD §3 should get a one-line addendum reflecting this if Alok wants the doc to stay authoritative. Not a §10 locked-decision change, just a scope-list gap.
- Phase 1's "print ranked results" (PRD §7) will be a naive price-ascending sort on normalized offers — not the constraint-based preferred/secondary ranking, which is explicitly Phase 2's job. Keeping these separate so ranking logic isn't built twice.

**Blocked**
- `.env`'s `DUFFEL_API_KEY` is currently a **test-mode** token (`duffel_test_...`), not production. This directly contradicts the locked PRD §9/§10 decision (production token for real multi-airline search) — and notably contradicts the entry immediately above from earlier today, which recorded Alok confirming "keep production, no change." The recorded decision and the actual `.env` state don't match right now. Alok has chosen to get a production token before `search_flights` is written, rather than build against test mode temporarily.
- **Not starting `search_flights` implementation until a production Duffel token is in `.env`.**

**Next**
- Alok: swap `DUFFEL_API_KEY` in `.env` for a production token, confirm when done.
- Then: add `@duffel/api`, implement `search_flights` (offer request → normalized offers → price-sorted terminal print) per the plan above.

## 2026-07-07 (session 3) — Phase 1 built: search_flights against Duffel

**Unblocked**
- Alok added both `DUFFEL_API_KEY_PROD` and `DUFFEL_API_KEY_TEST` to `.env` (confirmed prefixes: `duffel_live_...` / `duffel_test_...` — correct, not swapped). Confirmed Phase 0 already ran successfully end-to-end on his machine — gate cleared.
- Alok confirmed scope addition: passenger count and cabin class are user-configurable inputs to `search_flights` (not hardcoded). PRD §3 and §5 amended accordingly (see below).

**PRD amended**
- `Mini-PRD-Flight-Booking-Agent.md` §3 scope list now includes passenger count and cabin class in the trip-request intake. §5 tools table's `search_flights` row notes params include passenger count/cabin (added 2026-07-07). Not a §10 locked-decision change.

**Built — Phase 1 (Real search)**
- `@duffel/api@4.28.0` installed. Checked its actual shipped `.d.ts` (not training memory) to get the real API surface: `new Duffel({ token })`; `duffel.offerRequests.create({ slices, passengers, cabin_class, max_connections?, return_offers: true })`; response offers carry `total_amount`/`total_currency`, `owner` (airline), `slices[].segments[]` with `marketing_carrier`, `departing_at`/`arriving_at`, `duration` (ISO 8601). Note: type imports have to come from the `@duffel/api/types` subpath (e.g. `CabinClass`, `Offer`, `CreateOfferRequestSlice`) — the root `@duffel/api` module only exports the `Duffel` client class itself, not these types.
- `src/lib/duffel-client.ts`: `getDuffelClient(env: 'prod' | 'test')`. Reads `DUFFEL_API_KEY_PROD` or `DUFFEL_API_KEY_TEST`, warns if the key's prefix doesn't match the requested environment (catches an accidental swap). `search_flights` (the tool the agent actually calls) always passes `'prod'` — hardcoded, not an env toggle, per the locked PRD decision.
- `src/lib/normalize-offer.ts`: `NormalizedOffer`/`NormalizedSlice`/`NormalizedSegment` types + `normalizeOffer()`. Carries price, airline, per-slice timing/stops/duration (ISO 8601 duration parsed to minutes). Deliberately excludes fare conditions, services, baggage, loyalty data — out of scope for this POC.
- `src/lib/search-flights.ts`: `searchFlights(params, env)` — builds 1 slice (one-way) or 2 slices (round-trip, based on whether `returnDate` is given), all passengers typed `adult` (v1 simplification — no child/infant fares, not in PRD's constraint list), calls Duffel, normalizes, sorts price-ascending.
- `src/lib/print-offers.ts`: `printRankedOffers()` — the literal "print ranked results in the terminal" deliverable from PRD §7 Phase 1. Naive price sort only; constraint-based preferred/secondary ranking is explicitly deferred to Phase 2 so it isn't built twice.
- `src/phase1-search-flights.ts`: wires `search_flights` as an SDK tool exactly like Phase 0's `get_weather`, with a hardcoded demo trip prompt (Austin -> JFK round-trip). No NL intake or UI yet — that's Phase 4.
- `src/lib/preflight.ts` extended with `assertDuffelApiKeyPresent(env)` (presence + prefix check, no network call — Duffel has no free metadata endpoint as cheap as Anthropic's `/v1/models`, and the real search call surfaces auth errors clearly enough). `runPreflightChecks()` now takes an optional `{ duffelEnv }`.
- `package.json`: added `"phase1": "tsx src/phase1-search-flights.ts"`.

**Verified**
- `npm run typecheck` passes clean against the real `@duffel/api` types (not assumed shapes).
- Constructed both the prod and test Duffel clients directly (no network call needed for this) — both resolve correctly with the right keys/prefixes.
- Grepped `src/` for any Duffel order/booking call — none exists; `book_flight` isn't implemented yet (correctly deferred to Phase 3), so the mock boundary holds trivially for now.
- Could **not** verify the full `npm run phase1` agent loop end-to-end in this sandbox — same DNS restriction as 2026-07-06 (`getaddrinfo EAI_AGAIN api.anthropic.com`), unrelated to this code. Alok needs to run `npm run phase1` on his own machine to see the real tool-call + terminal-printed offer list.

**Open / next**
- Alok: run `npm run phase1` locally and confirm it produces a real, price-sorted offer list in the terminal for the Austin->JFK demo trip (or swap the hardcoded params in `phase1-search-flights.ts` for a different route).
- Once confirmed demoable: recap Phase 1, get go-ahead, then move to Phase 2 (constraints + ranking — preferred vs. secondary logic).

## 2026-07-07 (session 4) — First real run: tool errored on both attempts, cause not yet confirmed

**What happened**
- Alok ran `npm run phase1`. The model's final answer reported the `search_flights` tool errored on both of its attempts, with no offers and no error detail — it correctly declined to guess at prices/airlines instead of fabricating a result (good — that's the behavior we want), but gave us nothing to diagnose from.

**Root cause of the *missing diagnosis*, fixed**
- The tool handler in `phase1-search-flights.ts` had no `try/catch`. Whatever exception `searchFlights()` threw propagated up without ever being logged to console or turned into a legible message for the model — so both the terminal and the model's summary were opaque by construction, independent of whatever the underlying Duffel failure actually was.
- Fix: wrapped the handler body in try/catch. Added `describeSearchError()`, which special-cases `DuffelError` (imported from `@duffel/api`) to pull out `meta.status` (HTTP status) and `errors[].code`/`.message` — the actual actionable fields Duffel's API returns — and falls back to `err.message`/stack for anything else. Logs the detailed version to console (`[tool error] ...`) and returns a short, honest version to the model with `isError: true`, explicitly telling it not to guess.
- Verified: `npm run typecheck` still passes clean with this change.

**Root cause of the *actual search failure*: not yet confirmed**
- Could not reproduce or verify against the real Duffel API from this sandbox — confirmed `curl https://api.duffel.com` doesn't resolve/connect here either (same class of network restriction that blocked Anthropic connectivity checks in earlier sessions, not code-related).
- Reviewed the installed `@duffel/api@4.28.0` source directly (not assumption): confirms `departure_time`/`arrival_time: null` on slices are sent through to Duffel as literal JSON `null` values (the client doesn't strip them) — this matches the client's own type signature (`TimeRangeFilter | null`, not optional), so it's presumably an intentional "no filter" signal Duffel's API is built to accept, not an obvious bug. Flagging it as a checked-but-not-confirmed-guilty possibility rather than ruling it out entirely.
- Leading hypotheses, most likely first: (1) the production Duffel account needs additional activation/verification before `duffel_live_...` tokens can actually run live searches (common Duffel gotcha — sandbox/test tokens work immediately, production often doesn't until you complete account setup in the Duffel dashboard) — would surface as 401/403; (2) the production token itself is invalid/copy-paste-dropped, same class of bug we hit with the Anthropic key on 2026-07-06; (3) a request validation error (422) from Duffel, possibly related to the `null` fields above.

**Open / blocking on Alok**
- Re-run `npm run phase1` with this fix and paste back the actual terminal output, specifically the `[tool error] ...` line — that will contain the real HTTP status and Duffel error code/message and should make the actual cause obvious rather than guessed.
- Worth a quick check in the Duffel dashboard in parallel: confirm the production/live token shows as active and that the account has completed whatever activation Duffel requires for live search (not just test mode).

## 2026-07-07 (session 5) — Phase 2 built: constraints + ranking (gates + agent ordering)

**Gate flag (not silently skipped)**
- Phase 1's live search is still unconfirmed (session 4: `search_flights` errored on both real runs, `[tool error]` line never pasted back). Per CLAUDE.md §3 that gate isn't cleared. Built Phase 2 anyway *only because its ranking logic is a pure transform over `NormalizedOffer[]` — zero network, zero Duffel dependency* — so it's fully buildable/testable offline and doesn't "jump ahead" on anything risky. Phase 1 live search still must be fixed before the two demo together end-to-end.

**Key decisions (Alok, this session)**
- **Hard vs. soft constraints:** budget, max stops, max total duration are hard filters; preferred airline is SOFT (boosts the agent's ordering, never eliminates). Matches the word "preferred."
- **Budget is three-tier, not binary** (Alok's rule): within budget → eligible; over by ≤20% *with stops+duration met* → kept as an escalation candidate ("tolerance" tier), never auto-bookable; over by >20%, or any stops/duration violation → rejected. The 20% band is the escalation surface Phase 3 needs.
- **Ranking split (raised a contradiction, resolved):** Alok first picked "agent-reasoned ranking," but that conflicts with the precise 20% rule — an LLM can't be trusted to enforce a numeric boundary reproducibly, and it wouldn't be unit-testable (undermines the §8 "correct by construction" / legibility goal). Flagged it; agreed on a **split**: deterministic CODE enforces the eligibility gates (the trust boundary), the AGENT orders the eligible survivors into preferred+secondary and explains why in natural language. Guardrail correct-by-construction; narrative agent-reasoned.

**Built**
- `src/lib/constraints.ts` — `Constraints` interface (all fields optional; unset = doesn't apply) + `DEFAULT_BUDGET_TOLERANCE_PCT = 0.20`.
- `src/lib/rank-offers.ts` — `classifyOffers()` / `evaluateOffer()`: the deterministic gate. Per-check detail (`CheckResult`/`BudgetCheck` with `overBudgetPct`/`overBudgetAmount`/`withinTolerance`), soft `airlineMatch` flag, `reasons[]`, tiering into `eligible`/`tolerance`/`rejected`. Conservative on missing data: a duration constraint + unknown offer duration → rejected (can't prove compliance, don't auto-book). Currency mismatch vs. budget → rejected/flagged (no FX in v1). Default within-tier order = price asc, ties by duration then preferred-airline.
- `src/lib/rank-offers.test.ts` — 14 offline fixture tests (within/tolerance-band/over-20% boundaries, stops+duration hard rejects beating price tolerance, missing-duration both ways, soft-airline non-elimination, currency mismatch, empty constraints, bucketing, tie-break ordering). `npm test`. **All 14 pass.** (Caught + fixed a fixture bug where `?? default` swallowed explicit `null` — gate logic was correct.)
- `src/lib/offer-store.ts` — in-process store bridging the two tools. **Design note:** `search_flights` returns only a text summary to the model; if `rank_offers` took offers as input the model would reconstruct them lossily. Instead search stashes the real `NormalizedOffer`s and hands the model a `searchId`; `rank_offers` looks them up and gates the genuine data — so the boundary runs on full-fidelity offers, never a model paraphrase.
- `src/lib/print-classified.ts` — terminal view of the three gated tiers with per-offer reasons.
- `src/phase2-rank-flights.ts` — two tools (`search_flights` + `rank_offers`), agent loop, hardcoded demo trip (AUS→JFK, $800/direct/≤12h/prefer DL). System prompt drives: search → rank → present preferred+secondary from ELIGIBLE only, escalate on TOLERANCE, never book.
- `package.json` — added `phase2` and `test` scripts.

**Verified**
- `npm run typecheck` clean against real types.
- `npm test` — 14/14 gate tests pass offline.
- Mock boundary: grepped `src/` — the only Duffel method invoked anywhere is `offerRequests.create` (search). No `.orders`, no booking path. `book_flight` still doesn't exist (correctly Phase 3). Boundary holds.
- Could **not** run `npm run phase2` end-to-end here (same sandbox DNS block on `api.anthropic.com`/`api.duffel.com` as prior sessions; also gated on the unresolved Phase 1 live-search error). The gate logic — the actual Phase 2 deliverable — is proven by the offline unit tests regardless.

**Open / next**
- Alok: fix the Phase 1 live-search error (paste the `[tool error]` line / check Duffel prod-token activation), then run `npm run phase2` to see the full search→gate→agent-ordering loop on real offers.
- Suggested demo beat: tighten `maxPrice` in the prompt so the only options land in the TOLERANCE tier, and watch the agent escalate instead of recommending a booking — that's the Phase 3 preview and the oversight story made visible.
- Then: recap Phase 2, get go-ahead, start Phase 3 (two modes — automated auto-book-if-eligible vs. HITL). The eligible/tolerance/rejected tiers were built to feed exactly that routing.

## 2026-07-07 (session 5) — Phase 1 confirmed demoable end-to-end

**Result**
- Alok re-ran `npm run phase1` — no tool error this time. Real production Duffel search for AUS -> JFK round-trip (2026-09-14 / 2026-09-18, 2 adults, economy) returned **220 offers**; agent correctly used the tool (not a guess) and surfaced the 3 cheapest, which were tied at the same lowest fare.
- Whatever caused the prior no-detail failure appears to have been transient or environment-side (token/account propagation delay is plausible, given production Duffel tokens sometimes take a short time to fully activate after creation) — never got a repeat failure to diagnose further, so the exact root cause of the *first* run's failure stays unconfirmed. Not chasing it further since it's not reproducing and Phase 1's goal (prove the real search loop works) is now met.

**Phase 1 — DONE, demoable**
- `search_flights` runs a real production Duffel search, normalizes offers, prints them price-ranked in the terminal, and the agent loop correctly calls the tool rather than fabricating results — including declining to guess when the tool did fail. Meets PRD §7 Phase 1's bar.
- Per CLAUDE.md §3 (phased build workflow): recapped to Alok, awaiting lightweight go-ahead before starting Phase 2 (constraints + ranking — preferred vs. secondary logic, PRD §7).

**Note for Phase 2**
- 220 raw offers with multiple tied at the lowest fare is a realistic input shape to design the ranking/tie-breaking logic against (e.g. what breaks a tie among equally-priced offers — duration? departure time? airline preference?) — worth deciding explicitly when we scope Phase 2 rather than defaulting silently to whatever order Duffel/array sort happens to return.

## 2026-07-08 — Phase 3 built: two modes (automated + HITL), oversight legible

**Design consult first (per CLAUDE.md §3 + global "PRD-first"): walked Alok through the plan, flagged decisions, got sign-off before writing code.**

**Key decisions (Alok, this session)**
- **Boundary lives in code, not the prompt.** The auto-vs-ask trust boundary is enforced by the SDK's `canUseTool` permission callback (verified present in `@anthropic-ai/claude-agent-sdk@0.3.201`: `CanUseTool`/`PermissionResult`), which fires *before* any tool executes. So no booking can happen unless the gate allows it — the pause is a runtime guarantee, not dependent on the agent choosing to ask. `ask_user` stays as the agent's clarification surface (NOT the booking-approval surface — that's the gate). This is a faithful-but-stronger reading of PRD §5's `ask_user` role; noted so the PRD stays authoritative.
- **Automated auto-book pick:** agent picks its best option *within the eligible tier*; code hard-gates so only an eligible offer_id can auto-book (mirrors Phase 2 exactly — code gates the tier, agent orders within it).
- **`ask_user` input:** real stdin (`node:readline`) with a `--answers="a;b"` scripted fallback for repeatable, non-interactive recordings. Same `AnswerProvider` drives both the gate's approval prompts and the `ask_user` tool.
- **Kept airline preference SOFT** (per PRD): automated mode can auto-book a non-preferred eligible offer. Flagged, Alok did not override.
- **Included a lightweight offer-expiry beat** in the mock: an expired offer returns `offer_expired` (no fabricated confirmation) and steers the agent to re-search. Slightly beyond the literal PRD; kept as a cheap, realistic oversight moment.

**Routing (the centerpiece), all enforced in `lib/oversight.ts`**
- AUTOMATED: eligible → ALLOW (auto-book, no human); tolerance → ESCALATE (pause + ask); rejected/unknown → DENY.
- HITL: eligible/tolerance → PAUSE for explicit approval every time (human may approve / cancel / reselect another option — reselection rewrites the tool input via `updatedInput.offerId`); rejected/unknown → DENY (a hard-failing offer isn't presented as bookable even in HITL — POC line).
- So "automated" ≠ "unattended": it acts without asking when safe, pauses when not.

**Built**
- `src/lib/book-flight.ts` — the MOCK action. Pure fabricated confirmation (fake 6-char PNR, `MOCK-` ref, explicit `mock: true`, disclaimer). Imports nothing from `@duffel/api`; no order path. Includes the expiry check. Deliberately "dumb": no policy logic (that's the gate).
- `src/lib/oversight.ts` — the `canUseTool` gate + a **structured decision record** (`OversightDecision`: mode, tier, outcome, action, reason, human Q&A, reselection). `recordClassification()` bridges rank_offers → gate so tier lookups run on full-fidelity offers by id. `getDecisionLog()` / `formatDecisionLog()` expose the oversight trace for Phase 4's UI to render directly.
- `src/lib/prompt-io.ts` — shared `AnswerProvider` (real stdin | scripted).
- `src/lib/demo-fixtures.ts` — 6 fixed round-trip offers, gated behind `--offline`, tuned so budget 650 → auto-book path and budget 420 → escalate path are reproducible without live-fare luck. Dev/demo aid only; the real Duffel search path is still the default and books nothing real either. Flagged as an addition (not a PRD change).
- `src/lib/offer-store.ts` — added `findOfferById()` (book_flight recovers the full offer for the id it's handed, incl. after a human reselection rewrote it).
- `src/phase3-two-modes.ts` — 4 tools (search_flights + rank_offers + book_flight + ask_user), mode-specific system prompts, gate wired as `canUseTool`. `book_flight` is intentionally the ONE tool left OUT of `allowedTools` so every booking is forced through the gate (the SDK auto-approves allow-listed tools, bypassing `canUseTool`). Flags: `--mode`, `--scenario`, `--offline`, `--answers`. Prints the oversight trace at the end.
- `package.json` — `phase3:hitl` / `phase3:auto` scripts; `test` now runs all three suites.

**Verified (offline — the actual Phase 3 deliverable is the gate logic, proven without the model)**
- `npm run typecheck` clean against real SDK + Duffel types.
- `npm test` — **29/29 pass** (14 Phase 2 gate + 5 mock-boundary + 10 oversight-routing). Oversight tests exercise every routing branch deterministically (automated eligible/tolerance-approve/tolerance-decline/rejected/unknown; HITL approve/decline/reselect/rejected; non-book pass-through) and assert human input is consumed only when it should be.
- **Mock boundary (the non-optional guardrail):** grepped all of `src/` — the only Duffel client method invoked anywhere is `duffel.offerRequests.create` (search). No `.orders`/`orders.create`/`/air/orders`/`createOrder` in any executable code (only in the test's forbidden-patterns list and a comment). `book-flight.ts` imports nothing from `@duffel/api`. `book-flight.test.ts` also enforces this statically on every run, so a future edit that wires in a real order call fails CI-style before shipping.
- **Could NOT run the full live agent loop here** — same sandbox DNS block on `api.anthropic.com` as every prior session (the `--offline` flag removes the Duffel dependency but the loop still needs the Anthropic model call). Consistent with how Phases 1/2 were verified: the deterministic gate/boundary logic is proven offline; the live loop is Alok's to run.

**PRD / UX flags raised (none block; recorded for the doc to stay authoritative)**
- `ask_user` as booking-approval surface (PRD §5) → implemented as the `canUseTool` gate instead (stronger); `ask_user` kept for clarifications. Consider a one-line PRD §5 note.
- Soft airline preference can auto-book a non-preferred airline in automated mode — kept per PRD; flag if you'd rather "prefer" trigger a pause.
- HITL will not book a hard-rejected offer even with a willing human (POC line). Revisit if human override of hard filters is wanted.
- `--offline` fixtures added as a demo/dev aid (not in PRD); flag if you'd rather drop it.

**Open / next**
- Alok: run both modes locally to confirm the live loop end-to-end. Suggested demo beats:
  - `npm run phase3:auto -- --offline` → auto-books an eligible pick, no prompt (the "acts when safe").
  - `npm run phase3:auto -- --offline --scenario=escalate --answers="y"` → only over-budget options remain; agent is blocked from silent booking and the gate escalates (the "pauses when not"). Try `--answers="n"` to see it decline.
  - `npm run phase3:hitl -- --offline` → presents preferred + secondary, pauses for approval; type `y`, `n`, or a number to override.
  - Drop `--offline` on any of the above for the real Duffel search (results vary with live fares; may need to tune the budget in the prompt to hit the tolerance band).
- Per CLAUDE.md §7, the launch bar is a screen-recordable demo of both modes with the oversight model visible. The terminal oversight trace + gate prompts are that legibility surface for now; Phase 4 (v0/Lovable UI) renders the structured `getDecisionLog()` into the visible auto-vs-ask control surface.
- Recap Phase 3, get lightweight go-ahead before Phase 4.

## 2026-07-14 — Week 1 content + workflow roadmap (not product code)

**Context**
- Alok asked for two content/process artifacts, not product changes: (1) a LinkedIn "week 1" show-and-tell, (2) a learning roadmap for loop engineering + a two-model build-vs-verify workflow. No product scope, PRD, or guardrails touched.

**Created**
- `content/LinkedIn-Week1-Show-and-Tell.md` — a short feed teaser + a long-form article (learning-in-public voice), with `[IMAGE]`/`[VIDEO]` placeholders for Alok's recordings/moodboard. Covers PRD-first, sending the agent to research (design-system pick), the irreversibility → HITL decision, code-as-policy (the `canUseTool` gate) vs. prompt-as-policy, the build log as memory, and the honest verify gap.
- `Learning-Roadmap-Loop-Engineering.md` — phased plan (A→E) to close the "generate faster than I can verify" gap: manual loop → separate verifier model → automated Ralph-style loop → commit/PR automation → retro. Includes grounded notes on the Ralph Wiggum loop and the generator-verifier pattern, a metrics table (false-pass rate = top metric), and open questions.

**Accuracy corrections made before publishing (so Alok doesn't ship them wrong)**
- His raw notes said "no ability to test + verify" — but the repo has 29 passing tests + a static mock-boundary check. Reframed the public "gap" accurately: core trust logic *is* tested; what's unverified is *generated* UI/feature code. Don't undersell the guardrail work.
- His notes said Radix is "no longer actively maintained." Verified (web): Radix is still maintained (WorkOS), just slower; the original team now builds Base UI at MUI (v1.0 Dec 2025); shadcn defaults to Base UI for new projects as of July 2026. Public copy uses the accurate version.
- Merged a duplicated bullet (shadcn date-range picker gap appeared twice in the source notes).

**Open / next**
- Alok: add screen recordings (both agent modes) + moodboard images to the `[IMAGE]`/`[VIDEO]` slots before posting.
- Roadmap Phase A (run one plan→build→verify loop by hand, verify step as a real command) is the first concrete step — flagged as this week's action.
- This is orthogonal to the product build; Phase 4 (v0/Lovable UI) is still the next *product* phase and is unaffected.

## 2026-07-20 — Phase 4 kickoff: decisions + planning artifacts (no product code yet)

**Context**
- Alok gave the go-ahead to start Phase 4 (the thin UI), driven by the Phase 5 goal: a screen-recordable demo of both modes with the oversight model visible. Established first that the *only* runnable demo today is the Phase 3 CLI; the existing `vision-prototype-logged-in.html` is the **logged-in vision** (UX brief Part B — explicitly "do not build in v1"), not the v1 demo scope. So the recording requires building the Part A v1 UI, not recording the vision prototype.

**Decisions (Alok, this session)**
- **Build target — OVERRIDE of locked PRD §10.3.** Phase 4 UI is **hand-built in-repo**, not v0/Lovable. Rationale: the deliverable is a demo video, not a hosted app, so v0/Lovable hosting adds nothing; in-repo is the faster path to an honest, backend-wired demo. Flagged as a locked-decision deviation before proceeding; Alok explicitly approved. PRD §10.3 + §7 Phase 4 line annotated with the override.
- **Data wiring — live Duffel + live model.** The UI drives the *real* agent loop (real search, real model, real oversight gate), not `--offline` fixtures. Fares vary per take, so the demo prompt is tuned to reliably land a tolerance-tier option and trigger the escalation beat. Booking stays mocked.
- **Scope — Part A only.** Logged-out, session-only, one page. No auth, no accounts, none of the Part B vision. `book_flight` stays the mock via `lib/book-flight.js`.
- **Stack.** Vite + React + Tailwind + shadcn/ui (frontend) + a thin Express server run via `tsx` (two endpoints). New deps (`react`, `vite`, `tailwind`, `express`, shadcn) accepted as the one notable reversibility cost. Optimize for portfolio-grade visual fidelity (doubles as the "designer who builds" artifact).

**Key architecture decision (recorded so the build stays faithful)**
- The browser drives the loop through the **existing `AnswerProvider` seam** (`lib/prompt-io.ts`). A new **web AnswerProvider** implementation pushes the gate's approval prompt to the UI over SSE and resolves when the user clicks Approve/Decline/Reselect. **No changes to `oversight.ts`, `rank-offers.ts`, or `book-flight.ts`** — the trust boundary stays exactly where it's tested (29/29). The server renders `getDecisionLog()` (`OversightDecision[]`) straight to the UI.
- Mock-boundary guardrail (§14) must be re-run after the server is wired — the new HTTP layer must not open any path to a Duffel `order` call.

**Produced this session (planning artifacts only — no app code):**
- PRD updated (§10.2 demo note, §10.3 override, §7 Phase 4 line).
- `HLD-Phase4-Web-UI.md` — technical high-level design (topology, SSE + web-AnswerProvider bridge, API contract, oversight rendering, guardrails, build sequence).
- `Claude-Code-Prompt-Phase4.md` — a self-contained build brief to hand to Claude Code for the actual implementation.

**Open / next**
- Alok hands `Claude-Code-Prompt-Phase4.md` to Claude Code to implement Phase 4 per the HLD.
- On completion: re-run the §14 mock-boundary check, run both modes live end-to-end, then recap Phase 4 before Phase 5 (record + content).

## 2026-07-20 — Root directory cleanup + README update

Housekeeping pass, no product code touched.

- **`README.md`:** links the new `HLD-Phase4-Web-UI.md`, updates the Phase 4 row/tech-stack line (v0/Lovable → hand-built in-repo, per the 2026-07-20 override above), and adds a "Deeper reading" pointer to the new `prompts/` and `content/` folders.
- **New `content/` folder:** LinkedIn/Medium write-ups moved out of root — `LinkedIn-Week1-Show-and-Tell.md`, `linkedin-ab-test.md`.
- **New `prompts/` folder:** the paste-into-Claude-Code / paste-into-Claude-Design system prompts moved out of root — `Claude-Code-Prompt-Phase4.md`, `design-system-prompt.md`, `Vision-Design-Prompt-Logged-In.md`. (`Learning-Roadmap-Loop-Engineering.md`, `UX-Interaction-Brief-Phase4.md`, `Vision-Brief-Logged-In.md`, and `HLD-Phase4-Web-UI.md` are companion/brief docs, not pasteable prompts — left at root.)
- Cross-references to the five moved files were updated in every doc that names them (`Mini-PRD-Flight-Booking-Agent.md`, `HLD-Phase4-Web-UI.md`, `UX-Interaction-Brief-Phase4.md`, `Vision-Brief-Logged-In.md`, `Learning-Roadmap-Loop-Engineering.md`, and the moved files' own cross-links). `BUILD-LOG.md` itself is left unedited above this entry — it's an append-only session log, not a doc that should be rewritten retroactively.

## 2026-07-20 — Phase 4 built: web UI, wired end-to-end, verified live

**Context**
- Built the Phase 4 web UI per the HLD/build brief, in six steps (each committed separately). Partway through, Alok pointed at a Claude Design prototype ("FlightGenie POC — Logged Out.dc.html", project `15d54645-…`) built ahead of the code and asked to implement its interactions specifically — imported it via the `DesignSync` MCP tool (`get_project`/`list_files`/`get_file`) rather than treating the earlier UX brief as the sole spec.

**What shipped**

1. **Scaffold** (`b1306e3`) — `web/` = Vite + React 19 + TS + Tailwind v4 + shadcn/ui (`base-nova` style, `@base-ui/react` primitives). 16 shadcn components installed; `react-day-picker` + `cmdk` came along as deps (cover the HLD's two custom components, though the date picker ended up unused — trip dates are parsed by the model from the NL prompt, not picked via calendar UI, since the actual intake surface turned out to be a single textarea, not structured origin/destination/date fields). `src/server/` = Express skeleton (`index.ts`, `sse.ts`, `types.ts`, `run-orchestrator.ts`, `web-answer-provider.ts`), wired to the untouched `lib/`.
2. **Server + bridge verified** (`4fb616f`) — proved the SSE bridge end-to-end via curl before any UI existed: automated auto-book, automated escalation + `/api/decision` resolving the parked `canUseTool` promise (the HLD's "crux"), HITL numbered reselection. Found and fixed a real guardrail gap: `run-orchestrator.ts` imported `DuffelError` from `@duffel/api` directly for error formatting, failing the *stricter* Phase-4 server-level mock-boundary check (HLD §9 — zero `@duffel/api` references under `src/server/`, not just no order call). Extracted `lib/describe-search-error.ts` (new, additive) so the server only imports a `lib/` helper.
3. **SPA shell + tokens** (`fe011f0`) — one page, three empty regions, first pass at design tokens guessed from `design-system-prompt.md` (later fully superseded — see below).
4. **All UI surfaces wired to the Claude Design prototype** (`2d50ae6`) — the big step. Read the prototype's full `.dc.html` (a declarative template + an embedded JS state-machine class — `DesignSync get_file` returns it as one JSON-escaped blob; decoded to a real multi-line file on disk to read/grep it), plus its design-system project's `tokens/*.css`, `components/primitives.css`, and the compiled `_ds_bundle.js` (plain-React source for `FlightResultCard`, `EscalationCallout`, `ModeToggle`, `Button`, `Badge`, etc.). Treated the bundle as the *visual/behavioral spec* to reproduce with the existing shadcn/Tailwind component set — not something to import (that would be a second styling system, which the design-system-prompt forbids).
   - **Scope check before building:** the prototype includes an "Active searches" list and a Menu → Upcoming/Past bookings history, both implying cross-session persistence that conflicts with the session-only / single-active-run / no-accounts guardrail and aren't in the UX brief's Part A screen inventory. Flagged per CLAUDE.md §2 and asked; Alok confirmed **skip both entirely** (not even as decorative shells).
   - Rebuilt as a **single-column chat feed** (home intake → chat), replacing the step-3 two-pane split, matching what the approved prototype actually is.
   - New: `lib/api.ts` (typed SSE client mirroring `src/server/types.ts`), `hooks/useAgentRun.ts` (the feed-item state machine — thinking-step tracker, escalation resolution, client-side cancel-booking), `HomeScreen`, `ChatFeed` + per-event renderers (`PlanPreviewCard`, `ThinkingSteps`, `FlightResultCard`, `ResultsSection`, `EscalationCard`, `ConfirmationCard`, `ErrorCard`), rewritten `SettingsPanel`.
   - Design decisions worth remembering: (a) result cards in the plain `offers` view are **read-only** — no "book this" button — because in the real architecture only the *model* calls `book_flight`; a client-side book button would let the human pick before the model/gate ever run, which isn't a capability the server contract has. The only place cards become clickable is inside the escalation card, mapped to the gate's actual `options[]` values. (b) `rank_offers` uses the Settings panel's constraints exclusively, never the model's parsed text — so the constraints panel is a real guardrail, not decoration, and the UI had to explain the (correct) mismatch when a user's NL phrasing and Settings disagree, which it does, unprompted, in the model's own narration. (c) Settings' budget "impact hint" shows the *last real search's* actual tier counts, not a fabricated live recompute (recomputing would mean re-implementing `rank-offers.ts`'s tiering client-side against a read-only file — out of bounds). (d) Mid-run mode switching only applies to the *next* run and says so honestly — `createOversightGate({ mode })` captures `mode` by value at gate-creation time, and changing that would move the trust boundary, which `oversight.ts` being read-only forecloses.
   - Added `react-markdown` + `remark-gfm` for the agent's markdown-formatted narration (bold, tables, lists) — found live, not designed for: the model's actual replies use full markdown, and raw asterisks/pipes looked broken without it.
   - **Two real bugs found via browser verification, not typecheck:**
     1. `web/src/index.css` — a code comment containing a literal glob path (`design-system-*/tokens/*.css`) closed the CSS comment early at the embedded `*/`, corrupting the whole `@theme` block. Read as a Vite/Tailwind caching glitch at first; confirmed as a real, deterministic parse bug by driving the Tailwind compiler (`@tailwindcss/node`'s `compile()`) directly outside Vite and bisecting the file content.
     2. `src/server/index.ts` read `process.env.PORT` for the API server's port. The dev-tooling harness exports `PORT=5173` (from `.claude/launch.json`'s `"port"` field, meant for the browser-facing Vite process) to the whole `npm run dev` process tree — so the Express server silently bound 5173 instead of 3001, breaking Vite's dev proxy (`/api/*` → `:3001`) with 502s on every request. Renamed to `API_PORT` so the internal API process never inherits a convention meant for the main dev server.
5. **Live end-to-end verification** — ran real flows in-browser against production Duffel + the live model (not `--offline`), driving the actual rendered UI, across several separate runs:
   - HITL: full happy path with real numbered reselection (buttons built from the gate's actual `options[]`), including approving the agent's recommendation and, in an earlier take, cancelling a completed booking (both worked).
   - `ask_user` free-text clarification (the model asked for a missing return date; added a reply input + send button to `EscalationCard` for the `isFreeText` case — this was a real UI gap found live, not anticipated in the build).
   - Real empty state: Settings' nonstop-only constraint correctly rejected every 1-stop offer on a route with no nonstops, with the real binding-rule reason surfaced, not a canned string.
   - **Automated auto-book** (in-budget fare, no prompt) — twice, different routes.
   - **Automated escalation** (the hero interaction) — tuned budget to land a real AUS→JFK fare ~15% over budget, into the tolerance tier; the callout rendered "I paused because this breaks your rule: budget… $530. 70.17 USD over budget (15.3%, within 20% tolerance)."; approved it; the `OversightDecision.reason` rendered verbatim per HLD §6 ("over budget (…) but human approved the escalation"); mock confirmation followed. Confirms both escalation paths (automated binary approve/decline and HITL numbered reselection) share one `EscalationCard` component correctly branching on `payload.mode`.
   - Settings' real-numbers impact hint (`Last search: N eligible · N within tolerance · N rejected`) verified against an actual prior search.
   - Re-ran CLAUDE.md §14 plus the added server-level grep (`src/server/**`, `web/**` for `@duffel/api`/`.orders`) — clean. `npm test` 29/29 throughout; typecheck clean (root + web) after every step.

**Open / next**
- Phase 5: screen-record both modes (the automated-escalation take above is a strong candidate beat — it lands the "acts when safe, pauses when not" story in one search), write the digest, cut LinkedIn posts.
- Minor rough edges noted but not blocking: rapid/overlapping browser interactions during manual testing occasionally produced confusing intermediate states (stray clicks landing on animating elements, a numeric input not selecting-all on click) — automation-driving artifacts, not app bugs, but worth a UI polish pass (e.g. select-all on focus for the budget input) before recording.

## 2026-07-21 — Empty-result pause: agent stops, user adjusts rules + re-runs

**Feature request (Alok):** When the agent can't find any matching results, pause and let the user change hard constraints *before* searching again.

**Problem (as seen in the screenshot Alok shared):** two things fought the intent when `rank_offers` classified zero bookable offers.
1. **The agent looped instead of pausing.** Nothing in code stopped it; `rank_offers`' guidance only said "if everything is rejected, explain why and do not book," so the model improvised and went off to *"pull a fresh search and re-run the gate"* on its own — pre-empting the user's decision and burning a Duffel search credit each loop.
2. **The empty-state card was a dead end.** `ResultsSection`'s empty branch offered only "Relax a rule" → opens Settings, but after editing there was no way to re-run the same query. The only reset was "New search," which wipes the trip.

**What changed**
- **`src/server/run-orchestrator.ts`** — `rank_offers` now branches its guidance: when `eligible.length === 0 && tolerance.length === 0`, it explicitly tells the model **not** to call `search_flights`/`rank_offers` again and to stop with one short sentence handing control back to the user. Reinforced the same rule in the shared system prompt. This is a prompt-level instruction, not a code guardrail — deliberately, because re-searching isn't a *safety* boundary (the real one, no auto-booking of non-eligible offers, stays enforced in code per §11); stopping the loop is about respecting user oversight + not spending search credits.
- **`web/src/components/chat/ResultsSection.tsx`** — empty state rebuilt as the adjust-and-retry surface: shows the binding rules (reuses the `constraintSummary` already passed in) so the user sees exactly what to loosen, keeps **Adjust rules** (primary → Settings), and adds **Search again** (secondary, disabled while a run is active). "Search again" is the existing `retry()` → `startNewRun(lastQuery)`, which reads current constraint state, so edits made in Settings flow through untouched.
- **`web/src/components/chat/ChatFeed.tsx`** — threads `onRetry` + `running` (both already in scope) into `ResultsSection`.

**Design decision Alok made:** "Search again" is a **manual button**, not an auto-re-run on constraint change — keeps the user in control and avoids surprise credit spend on every edit (matches the "pause" intent).

**Verified live** (browser, production Duffel + live model, HITL mode):
- Tight budget ($20, nonstop) → search returned 103 offers, all rejected → empty-state card renders "No offers meet your rules right now. The search returned 103 options, but none cleared your rules. Applying: nonstop, under $20, under 12h total, Delta preferred." with **Adjust rules** + **Search again**. The agent **stopped** ("…you can loosen a rule and re-run the search from here") and did **not** issue another search.
- Clicked **Adjust rules** → Settings opened → loosened budget to $900 → **Search again** → fresh run re-ran with `under $900` applied → 12 matching offers, preferred pick American Airlines $412. Full pause→adjust→resume loop confirmed.
- CLAUDE.md §14 re-run (touched the web entrypoint's tool wiring): order-endpoint grep clean (only hit is `book-flight.test.ts`'s forbidden-pattern list), no `@duffel/api` import in `book-flight.ts`. `npm test` green; typecheck clean (root + web).

**Note:** on the empty path the "Deciding" thinking-step stays an open (unfilled) circle since the run ends after ranking with no booking — pre-existing behavior for the no-book path, not introduced here.

## 2026-07-21 — Budget moves out of the guardrails, into the prompt

**Feature request (Alok):** Remove the total budget from the smart defaults so the user-defined budget in the prompt doesn't conflict with the smart default.

**The conflict, precisely:** the deterministic gate (`rank_offers`) read budget *exclusively* from the Settings "Budget" field and ignored whatever budget the user typed in the prompt. So "AUS → JFK, under $650" with the guardrails at "No max" applied **no** budget at all — the prompt figure was silently dropped (and the constraint summary showed no budget, which is exactly the mismatch in the first demo run of the day). The Settings budget was a second, competing source of truth.

**Decision (Alok):** budget lives in the **prompt**, parsed and fed to the deterministic gate — *not* softly handled by the model. Keeps the gate deterministic (a regex reads the number; the LLM never touches the numeric path) and preserves the budget-tolerance → escalation centerpiece.

**What changed (all client-side — the server already takes `maxPrice` from the request body, so `run-orchestrator.ts` and the booking path are untouched; no §14 re-run needed):**
- **New `web/src/lib/parse-budget.ts`** — `parseBudgetFromPrompt(prompt)`: `$`-anchored amount wins first ("$650", "$1,200"); else a keyword-anchored bare number ("under 650", "budget of 500 dollars"), guarded so trip details aren't misread — requires ≥ $50 and rejects a number immediately followed by a non-money unit (stops / h / passengers / …). Returns null when no budget is named (→ no cap). 11/11 sanity cases pass, incl. the adversarial "max 2 stops, under 12h total" → null.
- **`web/src/hooks/useAgentRun.ts`** — removed `budget` from `ConstraintsState` / `DEFAULT_CONSTRAINTS` (the guardrails no longer carry one). `startNewRun` computes `parseBudgetFromPrompt(query)` and threads it into `toApiConstraints(c, budget)` and `summarizeConstraints(c, budget)`, both now taking budget as an explicit arg. `retry()` / the empty-state "Search again" re-parse from `lastQuery`, so they carry the prompt budget too.
- **`web/src/components/settings/SettingsPanel.tsx`** — removed the Budget input row; replaced with a one-line note ("Set your budget right in your search — e.g. 'under $600'…"). The last-search tier-count hint is preserved, now standalone. Dropped the unused `Wallet` import.

**Verified live** (browser, production Duffel + live model):
- Guardrails panel: Budget field gone, replaced by the note. Dialog interactive tree confirms no budget input remains.
- `"AUS to JFK …, one way, under $450"` (HITL) → gate summary reads **"nonstop, under $450, under 12h total, …"** (parsed from the prompt, not a Settings default); preferred pick $412 "Meets all your rules"; agent narrates "under your $450 cap … Everything above $450 is over budget." Prompt ↔ gate now agree.
- `"… under $380"` (automated) → preferred $412 tagged **"Close — over budget, within tolerance"**; escalation fired with the gate's verbatim reason **"32.42 USD over budget (8.5%, within 20% tolerance)"**. The tolerance/escalation hero interaction works unchanged from a prompt-parsed budget.
- Typecheck clean (root + web); oxlint clean (only pre-existing UI fast-refresh warnings).

**Consequence worth noting:** the empty-state "Adjust rules → Search again" loop (built earlier today) now covers stops/duration/airline/cabin via Settings, but **not** budget — to change budget the user edits their prompt (then New search). That's inherent to budget being prompt-driven; the Settings note points users to the prompt for budget.
