# Consumer Flight-Booking Agent

**A learning-in-public portfolio project by [Alok Jethanandani](https://madebyalok.com)** ([LinkedIn](https://www.linkedin.com/in/alokjethanandani/))

> This is not a product. It's a working proof-of-concept I built to go from "I prototype apps" to "I build agents" — and to make a real design point tangible: **when should an autonomous agent act on its own vs. stop and ask a human?**

## Why this project exists

I spend a lot of my product/design work thinking about how to design for human oversight of AI systems, not just their execution. This project is that idea made concrete and buildable: a flight-booking agent that comparison-shops real flights against your constraints — a budget you state right in your request (e.g. "under $600"), plus max stops, max duration, and an optional preferred airline that defaults to *any* — and then does one of two things —

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
| 4 — Thin UI | Browser app — chat + result cards + mode/constraint settings, hand-built in-repo (Vite/React + an Express/SSE bridge to the agent). Both modes verified live in-browser against production Duffel (see [`HLD-Phase4-Web-UI.md`](HLD-Phase4-Web-UI.md)) | ✅ Done |
| 5 — Demo + writeup | Screen-recorded walkthrough of both modes | 🚧 Planned |

Full detail on each phase — including dead ends, bugs found, and decisions reversed along the way — is in the running [`BUILD-LOG.md`](BUILD-LOG.md). The original design doc is [`Mini-PRD-Flight-Booking-Agent.md`](Mini-PRD-Flight-Booking-Agent.md).

## The core innovation: the decision to act or ask lives in code, not the prompt or the screen

The hard problem in this project isn't the flight search — it's deciding, for each result, whether the agent should book it on its own or stop and ask a person. That decision has to be reliable every single time, which means it can't be left to the two most persuadable parts of the system: the LLM's judgment and the UI's presentation layer.

**1. A deterministic gate classifies every offer before the agent reasons about it.** [`rank-offers.ts`](src/lib/rank-offers.ts) is plain, unit-tested code — not a model call — that sorts every search result into one of three tiers against the user's constraints (budget, stops, duration):
- **Eligible** — meets every constraint. Safe to auto-book.
- **Tolerance** — over budget by up to 20% but otherwise compliant. Never auto-booked; always a candidate for escalation.
- **Rejected** — breaks a hard constraint, or unknown data against a set constraint (conservative by default: missing information is treated as a failure, not a pass).

An LLM is good at judgment and bad at reliably enforcing a precise numeric line like "20% over budget." So that line is drawn in code. The agent only gets to reason *after* the gate has already filtered the field — it orders the eligible survivors into a preferred pick plus alternatives and explains its reasoning in plain language, but it never gets a vote on what counts as in-bounds.

The budget itself is stated in plain language in your request ("under $600"), but even that number never passes through the model: a regex ([`parse-budget.ts`](web/src/lib/parse-budget.ts)) extracts the figure and hands it straight to the gate. Reading budget from the prompt instead of a separate settings field also closes a silent conflict — the two can no longer disagree — while keeping the whole numeric path LLM-free.

**2. A second, independent gate decides whether a booking is allowed to execute at all.** Classifying an offer and being allowed to book it are two different questions, so they're two different pieces of code. `book_flight` is deliberately left out of the agent's allowed tools; every attempt to call it is intercepted by a permission callback (`canUseTool`) in [`oversight.ts`](src/lib/oversight.ts) that runs *before* the tool executes and returns allow, pause, or deny — never something the model can talk its way past. Mode selects the policy:
- **Automated mode:** eligible → books silently; tolerance → pauses and asks; rejected → denied outright.
- **Human-in-the-loop mode:** eligible *and* tolerance both pause for explicit approval; rejected is still denied even if a human would say yes — the system doesn't let a person override a hard constraint in this version.

Every decision — mode, tier, outcome, reasoning — is written to a structured log, so the automated/ask-a-human boundary is something you can point to and audit, not a black box you have to trust.

**3. The booking action itself can't reach a real transaction, even if every gate above were somehow bypassed.** `book_flight` is a mock: it fabricates a confirmation and never calls a real order API. This is enforced twice — once behaviorally (the function itself), and once statically, with a test that scans the booking code's actual source for any reference to a real order call. That test suite is the project's floor: nothing above it can compromise it.

**4. When the browser UI came along, it was built to render this boundary, not reimplement it.** The temptation was to put the act-vs-ask logic in the screen — check the budget, decide the color, render accordingly. Instead, the UI stays downstream of everything above: it displays the gate's output — green "meets all your rules," amber "slightly over budget, want to book anyway?", a receipt stamped `simulated` — but the decision itself is already made by the time it reaches the screen. The proof this held: the oversight and mock-boundary test suites didn't need to change while the entire UI was designed and built. If they had, that would have been the signal that the boundary had quietly moved into the presentation layer — the one place it can't be reliably enforced.

The design principle underneath all of it: an agent that's trustworthy enough to act autonomously some of the time has to make *where that line is* legible and provable — not a matter of prompting the model nicely, and not a matter of styling the UI convincingly.

## Key UX decisions

The section above proves the act-or-ask boundary is *real* — enforced in code, not talked into the model. This section is the other half: the interaction design that makes that boundary **perceptible, trustworthy, and overridable by a human**. Enforcing a line and making a person *see and control* it are two different problems. These are the deliberate design calls for the second one.

> ▶︎ The Tier-1 clips and Tier-2 stills below land with the Phase 5 recordings. Media lives in [`docs/media/`](docs/media/); until then the links are placeholders.

### 1. The pre-action plan preview — show the boundary *before* it's crossed

Before the agent does anything, it states what it will do on its own: *"I'll auto-book the best option that meets all your rules. If nothing qualifies, I'll stop and ask."* (Automated) / *"I'll find and rank options — you make every booking call."* (HITL)

Most "AI agent" UIs explain a decision *after* it's made. That's an audit log, not oversight. Oversight means a person can see where the autonomy line sits *before* the agent reaches it, and decide whether they're comfortable. Moving the boundary statement upstream of the action is the single clearest expression of "designed for oversight" rather than "a chatbot with buttons" — which is why it's the hero interaction of the case study.

[![Pre-action plan preview](docs/media/pre-action-preview.png)](docs/media/pre-action-preview.mp4)

### 2. Default to human-in-the-loop, not automated

A new session always starts in HITL. Automated is one toggle away — deliberately sequenced after, not hidden.

Trust in an autonomous system is earned, not granted on install. Defaulting to HITL means the first thing a user experiences is the agent *deferring* to them, and it guarantees the oversight/escalation moment surfaces on every run instead of only when something breaks. The safe default and the demonstration payoff happen to be the same choice. A defensible default is a design decision, not an accident of implementation.

[![Default HITL and the mode toggle](docs/media/default-hitl.png)](docs/media/default-hitl.mp4)

### 3. Status tiers use semantic color — and escalation is *warning*, never *error*

Every offer carries a status badge tied to its tier: **eligible → success** ("Meets all your rules"), **tolerance → warning** ("Close — slightly over budget"), **rejected → destructive** ("Breaks: max 1 stop"). The escalation callout — the "I paused because X" moment — is styled `warning`, not `destructive`. `destructive` is reserved for a genuine hard-constraint denial.

The color is doing trust-calibration work. If the agent pausing to ask looked like an error, users would learn to dread the pause — the exact behavior oversight depends on. Coloring escalation as "attention needed" instead of "something went wrong" teaches the opposite: the pause is the system working, not failing.

[![Status tiers and escalation tone](docs/media/status-tiers.png)](docs/media/status-tiers.mp4)

### 4. An escalation is never a dead end

When the agent stops and asks, the callout always carries an action row: **Approve anyway · Adjust the constraint · See alternatives** — with "Adjust the constraint" deep-linking straight to the field that triggered the pause.

The moment the agent defers is the highest-stakes point in the whole interaction — it's where trust is either honored or squandered. A pause with no path forward tells the user oversight means *dead-ended*, and they'll flip to full automation just to stop hitting walls. Every stop has to come with a next step, and the fastest one (fix the offending rule) has to be one click from the complaint.

[![Escalation callout with action row](docs/media/escalation-callout.png)](docs/media/escalation-callout.mp4)

### Supporting decisions

These extend the same principle — make the agent's reasoning and the guardrails legible — at lower stakes.

**Constraints as guardrails, not a search form.** Editing a constraint shows its impact live — *"1 stop max removes 4 of 6 options"* — so the user feels they're tuning the agent's autonomy envelope, not filling out a form. "Safe by construction" made tangible.

![Constraints panel with impact hints](docs/media/constraints-guardrails.png)

**A narrated loop, not a spinner.** The agent's work is shown as steps — *Searching flights → Ranking against your rules → Deciding* — turning unavoidable Duffel + model latency into proof the agent is reasoning, not a frozen wait.

![Narrated agent loop](docs/media/narrated-loop.png)

**Honest mock confirmation.** The fabricated receipt carries a persistent *"Simulated booking — no ticket issued, no card charged"* marker (not buried in fine print) and a cancel/undo affordance despite nothing being real — signaling the reversibility value even where the transaction is fake.

![Honest mock confirmation](docs/media/mock-confirmation.png)

**Reasoning is pull, not push.** "Why this rank" sits behind progressive disclosure so the thread stays scannable, and a light "close call" note appears when the top pick and runner-up are near-tied — so a confident pick and a tentative one don't render identically.

![Why this rank, with close-call signal](docs/media/why-this-rank.png)

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
| UI (Phase 4) | Hand-built in-repo — Vite + React + Tailwind + shadcn/ui, thin Express server streaming the agent over SSE (see [`HLD-Phase4-Web-UI.md`](HLD-Phase4-Web-UI.md)) |

## Technical architecture

The whole thing is one Node process. A React SPA (Vite) is the front end; a thin Express server runs the Claude Agent SDK's `query()` loop with four tools (`search_flights`, `rank_offers`, `book_flight`, `ask_user`) and the `canUseTool` oversight gate. In production the server serves the built SPA as static assets; in dev, Vite proxies `/api/*` to it. No database, no auth, no persisted state — a single in-memory session (v1 is deliberately logged-out). The Phase 0–3 terminal entrypoints still run the same agent pipeline headless.

**The one non-trivial problem was letting a browser drive an agent loop that was built for a terminal.** The Phase 3 oversight gate never read stdin directly — it takes an `AnswerProvider` and awaits `ask(prompt)`, and two implementations already existed (real stdin, and a scripted queue for recordings). The web app adds a third: when the gate needs a human decision, the web provider emits an SSE event to the browser and **parks its `resolve` function**, leaving the promise pending — `canUseTool` is async and will await a browser round-trip exactly as it awaited stdin. The browser POSTs the answer (`y` / `n` / a number for reselection) to `/api/decision`; the server calls the parked resolver; the gate resumes with its *existing* routing logic. The UI only transports the choice — it holds no routing rules — so `oversight.ts` needed no changes to gain a web front end.

The HTTP contract is three endpoints:

| Endpoint                | Purpose                                                                                                                          |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `POST /api/run`         | Start a run from `{ tripRequest, constraints, mode }`                                                                            |
| `GET /api/stream` (SSE) | Stream loop events — search/rank/decide steps, offers, the pre-action plan, escalations, the decision log, the mock confirmation |
| `POST /api/decision`    | Resolve a parked oversight gate with the human's `y` / `n` / number                                                              |

Every SSE event maps to an existing artifact of the loop — `classifyOffers` output, an `OversightDecision` record, the mock `BookingResult` — so the UI renders state it's handed rather than deriving any of it. Everything under `src/lib/` (search, the constraint gate, oversight, mock booking) was **read-only** for this phase: if the build had needed to touch it, that would have been the signal the trust boundary was leaking into the transport layer.

Full topology, the SSE + `AnswerProvider` bridge, the event and decision schemas, and the per-mode run lifecycle are in [`HLD-Phase4-Web-UI.md`](HLD-Phase4-Web-UI.md).


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

The browser app (Phase 4) is the primary way to run it — you type the trip, pick the mode, and watch the agent work:

```bash
npm run dev           # server + web together (Vite on :5173, hot reload) — the dev loop
npm run phase4        # build the web app and serve it from the single Express server
```

The Phase 0–3 terminal entry points still run the same pipeline headless:

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

The terminal phases use a hardcoded demo trip in their respective `src/phase*.ts` files; natural-language intake — typing the trip in your own words — lives in the Phase 4 browser app.

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
