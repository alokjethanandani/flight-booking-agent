# Consumer Flight-Booking Agent

**A learning-in-public portfolio project by [Alok Jethanandani](https://madebyalok.com)** ([LinkedIn](https://www.linkedin.com/in/alokjethanandani/))

> This is not a product. It's a working proof-of-concept I built to go from "I prototype apps" to "I build agents" — and to make a real design point tangible: **when should an autonomous agent act on its own vs. stop and ask a human?**

## Why this project exists

I spend a lot of my product/design work thinking about how to design for human oversight of AI systems, not just their execution. This project is that idea made concrete and buildable: a flight-booking agent that comparison-shops real flights against your constraints (budget, stops, duration, preferred airline), and then does one of two things —

- **Automated mode:** if the best option cleanly meets every constraint, book it. No human needed.
- **Human-in-the-loop mode:** if it doesn't — or if you've set the mode to always ask — the agent stops, shows you a preferred pick plus secondary options, and explains *why*, then waits for you to choose.

The mode toggle *is* the point. It's a small, legible demonstration of a trust boundary: where a system is confident enough to act, and where it should pause and defer.

**What I'm learning by building this:**
- How an actual agent loop works (tool definitions → model picks a tool → code executes it → result feeds back → repeat → stop) using the [Claude Agent SDK](https://www.npmjs.com/package/@anthropic-ai/claude-agent-sdk) — not a scripted flow.
- How to design a human-in-the-loop checkpoint in front of a consequential action.
- How to keep an agent's reasoning legible enough that a person can trust or override it, instead of it being a black box.

Real flight search, real airlines, real prices. **Booking is always mocked** — this agent can never spend real money or issue a real ticket. See [Guardrails](#guardrails--what-this-is-not) below.

## Project status: work in progress

This is being built in phases, each one demoable before moving to the next. Here's where it stands today:

| Phase | What it is | Status |
|---|---|---|
| 0 — Setup | Claude Agent SDK wired up, one dummy tool proving the loop works | ✅ Done |
| 1 — Real search | `search_flights` against Duffel's live API, normalized + price-ranked in the terminal | ✅ Done |
| 2 — Constraints + ranking | Deterministic budget/stops/duration gating, soft airline preference, preferred vs. secondary ordering | ✅ Done |
| 3 — Two modes | Automated (auto-book if in-constraint, else escalate) vs. HITL (always present + wait) — the design centerpiece | ✅ Done |
| 4 — Thin UI | Chat + result cards + mode/constraint settings, hand-built in-repo (see [`HLD-Phase4-Web-UI.md`](HLD-Phase4-Web-UI.md)) | 🚧 Planned |
| 5 — Demo + writeup | Screen-recorded walkthrough of both modes | 🚧 Planned |

Full detail on each phase — including dead ends, bugs found, and decisions reversed along the way — is in the running [`BUILD-LOG.md`](BUILD-LOG.md). The original design doc is [`Mini-PRD-Flight-Booking-Agent.md`](Mini-PRD-Flight-Booking-Agent.md).

## How it works today (Phases 0–3)

Right now this runs as a terminal script, not a UI:

1. A trip request (origin, destination, dates, passengers, cabin class, and constraints) is sent to `search_flights`, which calls Duffel's live production API and returns real, normalized offers.
2. `rank_offers` runs those offers through a **deterministic gate** — not the LLM — that classifies each offer as:
   - **Eligible** — meets budget, max stops, and max duration.
   - **Tolerance** — over budget by up to 20% but otherwise compliant; a candidate for escalation, never auto-bookable.
   - **Rejected** — over budget by more than 20%, or fails stops/duration.
   - Preferred airline is a *soft* signal — it reorders eligible results, it never disqualifies one.
3. The **agent** takes the eligible survivors and reasons about ordering them into a preferred pick + secondaries, explaining why in plain language.
4. When the agent calls `book_flight`, an **oversight gate** — the SDK's `canUseTool` permission callback — decides whether that booking is allowed to happen at all, *before* it executes:
   - **Automated mode:** an eligible pick auto-books with no human involved; a tolerance-tier pick pauses and asks; a rejected/unknown offer is denied outright.
   - **HITL mode:** every booking pauses for explicit human approval — approve, decline, or pick a different option from the list — regardless of tier (except hard-rejected offers, which are never presented as bookable).
   - `book_flight` itself is **mocked**: it fabricates a confirmation (fake PNR) and never calls Duffel's real order endpoint. See [Guardrails](#guardrails--what-this-is-not).
   - Every decision — mode, tier, outcome, and the plain-language reason — is written to a structured decision log, so the auto-vs-ask boundary is visible and explainable, not a black box.

The split matters: the pass/fail gate and the booking-approval gate are both code (deterministic, unit-tested, auditable). The model only orders eligible offers into a narrative preferred/secondary pick and explains its reasoning — it never gets to decide whether a booking is allowed to happen. An LLM shouldn't be trusted to enforce a precise numeric boundary reproducibly — that's a guardrail, not a suggestion.

## The core innovation: the decision to act or ask lives in code, not the prompt or the screen

The hard problem in this project isn't the flight search — it's deciding, for each result, whether the agent should book it on its own or stop and ask a person. That decision has to be reliable every single time, which means it can't be left to the two most persuadable parts of the system: the LLM's judgment and the UI's presentation layer.

**1. A deterministic gate classifies every offer before the agent reasons about it.** [`rank-offers.ts`](src/lib/rank-offers.ts) is plain, unit-tested code — not a model call — that sorts every search result into one of three tiers against the user's constraints (budget, stops, duration):
- **Eligible** — meets every constraint. Safe to auto-book.
- **Tolerance** — over budget by up to 20% but otherwise compliant. Never auto-booked; always a candidate for escalation.
- **Rejected** — breaks a hard constraint, or unknown data against a set constraint (conservative by default: missing information is treated as a failure, not a pass).

An LLM is good at judgment and bad at reliably enforcing a precise numeric line like "20% over budget." So that line is drawn in code. The agent only gets to reason *after* the gate has already filtered the field — it orders the eligible survivors into a preferred pick plus alternatives and explains its reasoning in plain language, but it never gets a vote on what counts as in-bounds.

**2. A second, independent gate decides whether a booking is allowed to execute at all.** Classifying an offer and being allowed to book it are two different questions, so they're two different pieces of code. `book_flight` is deliberately left out of the agent's allowed tools; every attempt to call it is intercepted by a permission callback (`canUseTool`) in [`oversight.ts`](src/lib/oversight.ts) that runs *before* the tool executes and returns allow, pause, or deny — never something the model can talk its way past. Mode selects the policy:
- **Automated mode:** eligible → books silently; tolerance → pauses and asks; rejected → denied outright.
- **Human-in-the-loop mode:** eligible *and* tolerance both pause for explicit approval; rejected is still denied even if a human would say yes — the system doesn't let a person override a hard constraint in this version.

Every decision — mode, tier, outcome, reasoning — is written to a structured log, so the automated/ask-a-human boundary is something you can point to and audit, not a black box you have to trust.

**3. The booking action itself can't reach a real transaction, even if every gate above were somehow bypassed.** `book_flight` is a mock: it fabricates a confirmation and never calls a real order API. This is enforced twice — once behaviorally (the function itself), and once statically, with a test that scans the booking code's actual source for any reference to a real order call. That test suite is the project's floor: nothing above it can compromise it.

**4. When the browser UI came along, it was built to render this boundary, not reimplement it.** The temptation was to put the act-vs-ask logic in the screen — check the budget, decide the color, render accordingly. Instead, the UI stays downstream of everything above: it displays the gate's output — green "meets all your rules," amber "slightly over budget, want to book anyway?", a receipt stamped `simulated` — but the decision itself is already made by the time it reaches the screen. The proof this held: the oversight and mock-boundary test suites didn't need to change while the entire UI was designed and built. If they had, that would have been the signal that the boundary had quietly moved into the presentation layer — the one place it can't be reliably enforced.

The design principle underneath all of it: an agent that's trustworthy enough to act autonomously some of the time has to make *where that line is* legible and provable — not a matter of prompting the model nicely, and not a matter of styling the UI convincingly.

## Guardrails — what this is not

- **`book_flight` is always mocked.** No code path calls Duffel's paid `order` endpoint — ever, in any mode. It returns a fake confirmation record. This is the one property of the project that isn't allowed to slip — it's enforced both behaviorally (the mock function itself) and statically (a test that scans the booking code's actual source for any Duffel order reference).
- **No real payment, ticketing, or PNRs.** Not now, not once the UI exists.
- **Not a shipped product.** This is a proof-of-concept: "done" means demoable end-to-end in both modes with the reasoning visible, not production-hardened, exhaustively tested, or handling every edge case.
- **Scope is intentionally narrow.** One-way and round-trip flights only. No hotels, cars, multi-city, loyalty/points, seat selection, or user accounts. See the PRD's non-goals for the full list.

## Tech stack

| Layer | Choice |
|---|---|
| Language | TypeScript, end-to-end |
| Agent runtime | [Claude Agent SDK](https://www.npmjs.com/package/@anthropic-ai/claude-agent-sdk) — tool-use loop + HITL checkpoints |
| Flight search | [`@duffel/api`](https://www.npmjs.com/package/@duffel/api), Duffel's official TS client, production search |
| Validation | Zod v4 |
| Runtime tooling | `tsx`, Node 18+ |
| UI (planned, Phase 4) | Hand-built in-repo — Vite + React + Tailwind + shadcn/ui, thin Express server (see [`HLD-Phase4-Web-UI.md`](HLD-Phase4-Web-UI.md)) |

## Setup

**Prerequisites:**
- Node 18+
- An [Anthropic API key](https://console.anthropic.com/)
- A [Duffel](https://duffel.com/) account with a **production** API token (test-mode tokens only return one sandbox airline, which defeats the point of comparison-shopping — search-only, so this is safe; booking is mocked regardless of which token is used)

```bash
git clone <this-repo>
cd flight-booking-agent
npm install
cp .env.example .env
```

Fill in `.env`:

```
ANTHROPIC_API_KEY=sk-ant-...
DUFFEL_API_KEY_PROD=duffel_live_...
DUFFEL_API_KEY_TEST=duffel_test_...   # optional, not used by default
```

## Running it

Each phase has its own runnable entry point:

```bash
npm run phase0        # dummy tool, proves the agent loop wiring
npm run phase1        # real Duffel search, price-ranked terminal output
npm run phase2        # search + constraint gating + agent-ordered preferred/secondary picks
npm run phase3:hitl   # search + gate + book — pauses for human approval on every booking
npm run phase3:auto   # search + gate + book — auto-books eligible picks, escalates the rest
npm test              # offline unit tests: constraint gate, mock boundary, oversight routing
npm run typecheck
```

Useful Phase 3 flags: `--scenario=autobook|escalate` (tunes the demo budget), `--offline` (uses fixed fixtures instead of a live Duffel call, for reproducible runs), `--answers="y;n;3"` (scripts the human replies for non-interactive recordings). See `src/phase3-two-modes.ts`'s header for the full list.

All phases currently use a hardcoded demo trip in their respective `src/phase*.ts` files — natural-language intake is planned for Phase 4 alongside the UI.

## Project structure

```
src/
  phase0-hello-world.ts     # Phase 0: minimal agent, one dummy tool
  phase1-search-flights.ts  # Phase 1: real search tool wired to the agent loop
  phase2-rank-flights.ts    # Phase 2: search + rank tools, agent orders the results
  phase3-two-modes.ts       # Phase 3: + book_flight (mock) + ask_user; oversight gate wired in
  lib/
    duffel-client.ts        # Duffel client factory (prod/test), key validation
    search-flights.ts       # Offer request -> normalized offers, price-sorted
    normalize-offer.ts      # Duffel offer shape -> internal NormalizedOffer
    constraints.ts          # Constraint definitions + budget tolerance
    rank-offers.ts          # The deterministic eligible/tolerance/rejected gate
    rank-offers.test.ts     # Offline unit tests for the gate
    offer-store.ts          # In-process bridge passing full-fidelity offers between tools
    oversight.ts            # The canUseTool gate — the auto-vs-ask trust boundary — + decision log
    oversight.test.ts       # Offline unit tests for every routing branch (automated + HITL)
    book-flight.ts          # The MOCK booking action; imports nothing from @duffel/api
    book-flight.test.ts     # Behavioral tests + a static scan proving no order-endpoint reference
    prompt-io.ts            # Human-answer provider: real stdin or scripted (--answers)
    demo-fixtures.ts        # Fixed offline offers for reproducible demo recordings (--offline)
    print-offers.ts         # Terminal rendering, Phase 1
    print-classified.ts     # Terminal rendering, Phase 2+
    preflight.ts            # Fail-fast credential checks before the agent loop starts
```

## Deeper reading

- [`Mini-PRD-Flight-Booking-Agent.md`](Mini-PRD-Flight-Booking-Agent.md) — the design doc: scope, architecture, phased plan, and the locked decisions this project won't silently deviate from.
- [`BUILD-LOG.md`](BUILD-LOG.md) — a session-by-session log of what got built, what broke, and why — including the parts that didn't work on the first try.
- [`HLD-Phase4-Web-UI.md`](HLD-Phase4-Web-UI.md) — the technical design for the Phase 4 web UI (topology, the SSE + web-`AnswerProvider` bridge, API contract, oversight rendering).
- [`UX-Interaction-Brief-Phase4.md`](UX-Interaction-Brief-Phase4.md) / [`Vision-Brief-Logged-In.md`](Vision-Brief-Logged-In.md) — behavior/flow specs for the v1 build and the (unbuilt) logged-in product vision, respectively.
- [`prompts/`](prompts/) — the system prompts used to generate the design system and drive Claude Code/Claude Design for this project.
- [`content/`](content/) — LinkedIn/Medium write-ups documenting the build in public.

## License

MIT — see [`LICENSE`](LICENSE).
