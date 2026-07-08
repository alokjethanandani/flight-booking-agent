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
| 3 — Two modes | Automated (auto-book if in-constraint, else escalate) vs. HITL (always present + wait) — the design centerpiece | 🚧 Planned |
| 4 — Thin UI | Chat + result cards + mode/constraint settings (v0/Lovable) | 🚧 Planned |
| 5 — Demo + writeup | Screen-recorded walkthrough of both modes | 🚧 Planned |

Full detail on each phase — including dead ends, bugs found, and decisions reversed along the way — is in the running [`BUILD-LOG.md`](BUILD-LOG.md). The original design doc is [`Mini-PRD-Flight-Booking-Agent.md`](Mini-PRD-Flight-Booking-Agent.md).

## How it works today (Phases 0–2)

Right now this runs as a terminal script, not a UI:

1. A hardcoded trip request (origin, destination, dates, passengers, cabin class) is sent to `search_flights`, which calls Duffel's live production API and returns real, normalized offers.
2. `rank_offers` runs those offers through a **deterministic gate** — not the LLM — that classifies each offer as:
   - **Eligible** — meets budget, max stops, and max duration.
   - **Tolerance** — over budget by up to 20% but otherwise compliant; a candidate for escalation, never auto-bookable.
   - **Rejected** — over budget by more than 20%, or fails stops/duration.
   - Preferred airline is a *soft* signal — it reorders eligible results, it never disqualifies one.
3. The **agent** takes the eligible survivors and reasons about ordering them into a preferred pick + secondaries, explaining why in plain language.

The split matters: the pass/fail gate is code (deterministic, unit-tested, auditable), and only the narrative ordering on top of it is left to the model. An LLM shouldn't be trusted to enforce a precise numeric boundary reproducibly — that's a guardrail, not a suggestion.

## Guardrails — what this is not

- **`book_flight` is always mocked.** No code path calls Duffel's paid `order` endpoint — ever, in any mode. It returns a fake confirmation record. This is the one property of the project that isn't allowed to slip.
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
| UI (planned, Phase 4) | v0 / Lovable — a thin chat + result cards + settings surface |

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
npm run phase0   # dummy tool, proves the agent loop wiring
npm run phase1   # real Duffel search, price-ranked terminal output
npm run phase2   # search + constraint gating + agent-ordered preferred/secondary picks
npm test         # offline unit tests for the constraint gate (no network calls)
npm run typecheck
```

`phase1` and `phase2` currently use a hardcoded demo trip in their respective `src/phase*.ts` files — natural-language intake is planned for Phase 4 alongside the UI.

## Project structure

```
src/
  phase0-hello-world.ts     # Phase 0: minimal agent, one dummy tool
  phase1-search-flights.ts  # Phase 1: real search tool wired to the agent loop
  phase2-rank-flights.ts    # Phase 2: search + rank tools, agent orders the results
  lib/
    duffel-client.ts        # Duffel client factory (prod/test), key validation
    search-flights.ts       # Offer request -> normalized offers, price-sorted
    normalize-offer.ts      # Duffel offer shape -> internal NormalizedOffer
    constraints.ts          # Constraint definitions + budget tolerance
    rank-offers.ts          # The deterministic eligible/tolerance/rejected gate
    rank-offers.test.ts     # Offline unit tests for the gate
    offer-store.ts          # In-process bridge passing full-fidelity offers between tools
    print-offers.ts         # Terminal rendering, Phase 1
    print-classified.ts     # Terminal rendering, Phase 2
    preflight.ts            # Fail-fast credential checks before the agent loop starts
```

## Deeper reading

- [`Mini-PRD-Flight-Booking-Agent.md`](Mini-PRD-Flight-Booking-Agent.md) — the design doc: scope, architecture, phased plan, and the locked decisions this project won't silently deviate from.
- [`BUILD-LOG.md`](BUILD-LOG.md) — a session-by-session log of what got built, what broke, and why — including the parts that didn't work on the first try.

## License

MIT — see [`LICENSE`](LICENSE).
