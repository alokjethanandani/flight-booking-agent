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
