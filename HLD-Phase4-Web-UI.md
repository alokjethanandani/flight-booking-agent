# Technical design: Phase 4 web UI

Owner: Alok Jethanandani. Drafted: July 20, 2026. Status: Implemented, with limits recorded below.

Source of truth: [product brief](Mini-PRD-Flight-Booking-Agent.md) for scope, [interaction brief](UX-Interaction-Brief-Phase4.md) for design intent, and [design-system prompt](prompts/design-system-prompt.md) for tokens. Source types in `src/server/types.ts` define the current API payloads.

## 1. Purpose

Connect the Phase 3 agent to a browser while keeping classification and booking permission in the existing core. The browser shows the plan, offers, approval requests, and simulated result.

I reused the human-answer interface because it already separated permission policy from input transport. That let browser approval follow the same route as terminal approval.

## 2. Constraints carried into this phase

| Constraint | Implementation requirement |
|---|---|
| Booking stays simulated | Call `src/lib/book-flight.ts`. Add no Duffel order request |
| No real payment, ticket, or passenger reservation | Label the fabricated confirmation clearly |
| No accounts or durable session storage | Keep run state in memory |
| Core owns permission | Transport questions and answers without duplicating the gate |
| Single-user demo | Allow one active run at a time |

The phase treated `oversight.ts`, `rank-offers.ts`, `book-flight.ts`, `constraints.ts`, `normalize-offer.ts`, `search-flights.ts`, and their tests as read-only. Changes to those files would require reviewing the boundary rather than absorbing them into UI work.

## 3. System topology

```text
Browser: React + Vite
  POST /api/run                  Start a run
  GET /api/stream?runId=...       Receive SSE events
  POST /api/decision             Answer a pending question
              |
Express + Claude Agent SDK
  query() + four tools + canUseTool
              |
src/lib: search, classification, oversight, simulated booking
              |
Duffel search API + Claude model
```

In development, Vite serves the UI on port 5173 and proxies `/api` to Express on port 3001. `npm run phase4` builds the SPA and serves it from Express.

## 4. Browser answers over SSE

### 4.1 Web `AnswerProvider`

The gate calls `answers.ask(prompt)` and awaits a string. Terminal input, scripted replies, and browser answers implement the same interface.

```ts
interface AnswerProvider {
  ask(prompt: string): Promise<string>;
  readonly scripted: boolean;
}
```

The web provider emits an `escalation` event and stores the promise resolver in the active run. A browser answer posted to `/api/decision` resolves that promise. The gate then continues with its existing routing.

Booking approval uses `y`, `n`, or a numbered manual-review selection. Clarification through `ask_user` accepts free text. The UI carries the answer without granting permission itself.

### 4.2 Transport choice

I chose SSE because the server sends a stream of updates while the browser sends discrete answers. HTTP POSTs cover those answers without adding a second bidirectional protocol.

## 5. API contract

| Endpoint | Input | Result |
|---|---|---|
| `POST /api/run` | `{ tripRequest, constraints, mode, offline?, hardAirline? }` | `{ runId }` |
| `GET /api/stream?runId=...` | Registered run ID | Starts the query loop and streams events |
| `POST /api/decision` | `{ runId, answer }` | `{ ok: true }` when a question is pending |

`mode` is `automated` or `hitl`. `constraints` supports `maxPrice`, `currency`, `maxStops`, `maxTotalDurationMinutes`, `preferredAirlines`, and `budgetTolerancePct`.

`hardAirline` is an optional IATA code. The server removes other carriers before classification. `offline` substitutes fixture offers for Duffel search while retaining the model loop. The browser uses live search by default.

### 5.1 SSE events

| Event | Payload | UI use |
|---|---|---|
| `plan_preview` | `{ mode, message }` | State the approval policy before action |
| `loop_step` | `{ label }`, with searching, ranking, or deciding | Show progress |
| `assistant_text` | `{ text }` | Show model narration |
| `offers` | `{ eligible, tolerance, rejected, searchedCount }` | Show classified flight cards |
| `escalation` | `{ mode, prompt, options, offers, requestedOfferId?, isFreeText }` | Request approval or clarification |
| `decision` | `OversightDecision` | Show the decision outcome |
| `confirmation` | `BookingResult` | Show a simulated receipt or expired offer |
| `error` | `{ message }` | Show the failure and retry control |
| `done` | `{ decisionLog }` | Finish the run |

`searchedCount` includes the original search results before a hard-airline filter. Displayed tier counts can therefore sum to less than the search count.

## 6. Rendering the oversight model

`src/lib/oversight.ts` defines the authoritative decision record:

```ts
interface OversightDecision {
  at: string;
  mode: 'automated' | 'hitl';
  toolName: string;
  requestedOfferId: string;
  tier: 'eligible' | 'tolerance' | 'rejected' | 'unknown';
  outcome: 'allow' | 'deny';
  action: 'auto-book' | 'escalated-approved' | 'escalated-declined'
        | 'blocked-rejected' | 'blocked-unknown'
        | 'hitl-approved' | 'hitl-declined';
  reason: string;
  finalOfferId?: string;
  humanPrompt?: string;
  humanAnswer?: string;
}
```

A pending approval is represented by an `escalation` event. It is not a separate `outcome` value. The final record contains `allow` or `deny`.

| Tier | Treatment | Meaning |
|---|---|---|
| `eligible` | Success | Meets the configured constraints |
| `tolerance` | Warning | Over budget within the tolerance band. Approval required |
| `rejected` | Alert | Fails a required check. Booking blocked |

The decision log retains the gate's exact reason. The chat feed maps known actions to shorter user-facing sentences. "Why this rank" shows classification reasons rather than a complete model explanation.

Result cards use the classifier's default sort. The model's recommendation can differ from the first result card. The approval card follows `requestedOfferId` when available.

## 7. Run lifecycle

| Path | Sequence |
|---|---|
| Automated, eligible | Search, classify, request booking, gate allows, simulated confirmation |
| Automated, tolerance | Search, classify, request booking, await approval, allow or deny |
| Manual review | Search, classify, present options, await approval or numbered reselection |
| No bookable results | Show the empty state. The user can adjust rules and search again |
| Missing trip information | Ask a free-text question and await the answer |

The plan arrives before tool execution. Mode changes during an active run apply to the next search. The original design proposed re-evaluating pending decisions, but that behavior is not implemented.

## 8. Session state

Mode, constraints, feed, and the pending UI state live in React memory. Reloading the page resets them. Theme preference uses `sessionStorage`.

The server tracks pending and active runs in memory. It removes active entries when the stream closes or the query finishes. There is no database, authentication, durable recovery, or supported multi-user session isolation.

## 9. Simulated booking boundary and verification

The HTTP layer uses the existing simulated booking module. It adds no direct Duffel client import.

Run `npm test` to check classification, simulated results, offer expiry, and oversight routing. The booking suite also scans the booking module for Duffel imports and order-call patterns.

Use `rg` to inspect `src/server/` for unexpected `@duffel/api` imports or order calls. Confirm that the application uses `duffel.offerRequests.create` for search. These checks cover current code and recognized patterns.

## 10. File layout

```text
src/lib/                        Shared search, gate, booking, and tests
src/phase3-two-modes.ts          Terminal entry point
src/server/index.ts             Express routes and static serving
src/server/run-orchestrator.ts  Query loop, tools, and event payloads
src/server/web-answer-provider.ts  Pending browser answers
src/server/sse.ts                Event framing and heartbeat
src/server/types.ts              HTTP and event types
web/src/                        React UI, state, and API client
```

The root scripts are `dev:server`, `dev:web`, `dev`, `build:web`, and `phase4`. Browser dependencies live in `web/package.json`.

## 11. Risks and open questions

| Risk | Handling or limit |
|---|---|
| Live fares vary between takes | Use actual fares in recordings. Keep terminal fixtures available |
| Long provider latency | Show tool progress and keep SSE alive with heartbeat comments |
| Mode changes during approval | Apply changes to the next search |
| Prompt details exceed deterministic checks | Disclose that time windows are model-interpreted |
| Result order differs from model recommendation | Distinguish default sorting from the requested offer |
| Browser disconnect | No durable resume. Stream closure does not establish cancellation of the agent loop |
| Vision features enter v1 | Keep accounts, payment, and standing rules in static concepts |

## 12. Definition of done

Demonstrate 2 browser modes against the live agent, with configurable constraints, a pre-action plan, approval requests, and an explicit simulated confirmation. Pass the core tests and inspect the new server for real order calls.

The build log records the Phase 4 browser checks. Live impact hints, close-call signals, direct setting links, and pending-decision re-evaluation remain unimplemented design intent.
