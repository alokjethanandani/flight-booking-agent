# Product brief: FlightGenie

Owner: Alok Jethanandani. Drafted: July 5, 2026. Status: Phases 0 through 4 implemented. Demo and publishing work remain in Phase 5.

Parent strategy reference: `Strategy-PRD-Personal-Brand-and-Job-Search.md` §7C. That document is outside this repository.

## 0. Overview

I built a flight-booking agent to test when automation should proceed and when a person should decide. It searches live Duffel offers, checks constraints in code, and simulates booking through the Claude Agent SDK.

Automated mode can book eligible offers without approval. Human-in-the-loop mode requires approval for every bookable offer. Both modes block rejected offers. Every booking is simulated.

## 1. Why this project

I chose flights because price, stops, and duration make the permission boundary concrete. A reviewer can compare the user's rules with the agent's proposed action.

The project serves three purposes: learning the agent loop, demonstrating oversight design, and creating material for a portfolio and interviews. It is independent of my work at BILL and contains no BILL IP.

## 2. Success criteria

- Explain and implement the tool-use loop: define tools, let the model select one, execute it, return the result, and continue until completion.
- Demonstrate 2 modes end to end in the browser, including automatic booking and explicit human approval.
- Show the plan before action, classified results, approval requests, and a simulated confirmation.
- Verify that the booking implementation makes no real order call.
- Record the demo and prepare a written analysis plus 2 to 3 LinkedIn posts.

Completion means a working, screen-recordable proof of concept. Production readiness and exhaustive error handling are outside this bar.

## 3. Scope

### In scope for v1

- Natural-language route and date intake for one-way and round-trip flights.
- A USD budget extracted from supported expressions in the trip request.
- Settings for stops, total duration, preferred airline, passenger count, cabin, and mode.
- Adult passengers and live Duffel search.
- Code-based classification with a model recommendation and explanation.
- Automated and human-in-the-loop booking permission.
- Chat, result cards, approval requests, and a simulated receipt.

Airline preference is soft by default. An optional hard-airline setting removes other carriers before classification. The browser's result-card order follows the code's default sort.

### Non-goals for v1

Real payment, real tickets, real passenger reservations, hotels, cars, multi-city trips, loyalty redemption, and seat selection are excluded. Accounts, production authentication, scale, and the B2B policy variant are also excluded.

Departure and arrival time windows can appear in requests, but the deterministic gate does not enforce them. Stops and duration use Settings values.

## 4. Constraints and guardrails

`book_flight` always returns a simulated result. No code path may create a Duffel order, including tests and demos. The production token is used for search only.

Keep the deliverable within the existing flight and oversight scope. The original planning estimate was 2 to 3 weeks part-time in Monday and Tuesday learning blocks. That estimate is a planning record, not a measured outcome.

## 5. Architecture

The agent and UI use TypeScript. The Claude Agent SDK runs the tool-use loop. Duffel's TypeScript client provides flight search. React, Vite, Tailwind, and shadcn/ui provide the browser interface.

| Tool | Responsibility | Boundary |
|---|---|---|
| `search_flights` | Search and normalize live offers | Store complete offers outside model-generated text |
| `rank_offers` | Apply constraints and return classified offers | Enforce budget, stops, duration, and currency checks in code |
| `ask_user` | Request missing information | Await a terminal or browser answer |
| `book_flight` | Return a simulated confirmation | Execute only after the permission gate allows it |

The gate allows eligible offers automatically only in automated mode. Offers within the budget tolerance require approval. Rejected and unknown offers remain blocked in both modes.

The default tolerance is 20% over budget when other hard constraints pass. A person cannot override a hard rejection in v1.

## 6. Learning sequence

1. Run a minimal agent with one dummy tool.
2. Observe tool selection, execution, and returned results.
3. Add an approval checkpoint before a booking attempt.
4. Connect live search, classification, and simulated booking.
5. Connect the browser through the existing human-answer interface.

## 7. Phased build plan

The estimates below record the original plan. Each phase ends with a runnable result.

| Phase | Deliverable | Original estimate | Status |
|---|---|---|---|
| 0 | SDK setup and dummy tool | Half a day | Implemented |
| 1 | Live search and terminal results | 2 to 3 sessions | Implemented |
| 2 | Constraints and classification | 1 to 2 sessions | Implemented |
| 3 | Automated and human-in-the-loop modes | 2 sessions | Implemented |
| 4 | Browser UI and settings | 2 to 3 sessions | Implemented |
| 5 | Recordings and publishing material | 1 to 2 sessions | Drafts exist. Final recording and publication status is not tracked here |

Phase 4 uses the [technical design](HLD-Phase4-Web-UI.md), [interaction brief](UX-Interaction-Brief-Phase4.md), and [design-system prompt](prompts/design-system-prompt.md).

## 8. Design decisions to demonstrate

| Decision | What the demo should show |
|---|---|
| When to act or ask | The same offer follows different approval rules under each mode |
| How constraints limit autonomy | Budget, stops, and duration determine eligibility before booking |
| How users review an exception | An over-budget option names the exception and waits for approval |
| How users compare choices | Classification reasons and the model's explanation remain available |
| How simulation is disclosed | The receipt states that no ticket or charge exists |

## 9. Risks

| Risk | Response |
|---|---|
| Scope expands into a booking product | Keep the v1 non-goals explicit |
| Sandbox search weakens comparison | Use production search and simulated booking |
| UI work obscures oversight behavior | Prioritize plan, approval, and confirmation surfaces |
| Model interpretation is mistaken for code enforcement | Name which constraints the deterministic gate checks |
| Live fares change between recordings | Record the actual result. Keep terminal fixtures available for repeatable search data |
| Test coverage is presented as a universal guarantee | Describe the behaviors and source patterns the tests check |

## 10. Recorded decisions

1. Language: TypeScript for the agent and browser. This matches the selected SDK and Duffel client.
2. Data: production Duffel search with simulated booking. Phase 4 uses live search and a live model by default.
3. UI: build in the repository with Vite, React, Tailwind, shadcn/ui, and an Express bridge. This supersedes the original v0/Lovable plan.
4. Trip types: one-way and round-trip only.
5. B2B policy mode: excluded from v1.

The UI decision changed on July 20, 2026, with Alok's approval. The deliverable was a recorded demo, so local integration with the running agent took priority over hosted-builder deployment. The build log preserves that history.
