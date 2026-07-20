# Build Brief for Claude Code — Phase 4 Web UI (FlightGenie)

Paste this into Claude Code from the repo root. It is the implementation brief for Phase 4. It is self-contained but assumes you will read the repo docs it points to before writing code.

---

## Your task

Build the Phase 4 thin web UI for the consumer flight-booking agent, hand-built in this repo, and wire it to the **existing** Phase 3 agent loop (real Duffel search + live Claude model + the `canUseTool` oversight gate + the mock booking). The goal is a **screen-recordable demo of both modes with the oversight model visible in the browser** — not a production app.

## Read first (do not skip — these are the source of truth, in priority order)

1. `CLAUDE.md` — project guardrails. §1 (mock boundary), §11 (design patterns), §14 (mock-boundary verification) are binding.
2. `Mini-PRD-Flight-Booking-Agent.md` — scope §3, guardrails §4, locked decisions §10 (note the 2026-07-20 override on §10.3 and the demo note on §10.2).
3. `HLD-Phase4-Web-UI.md` — **the technical design you are implementing.** Topology §3, the SSE + web-`AnswerProvider` bridge §4, API contract §5, oversight rendering §6, run lifecycle §7, file layout §10.
4. `UX-Interaction-Brief-Phase4.md` — behavior/flows/states. Part A is the build scope; **Part B is vision — do not build any of it.**
5. `design-system-prompt.md` — the visual system (shadcn tokens, white-canvas / color-as-signal / black-controls / pill geometry). The UI must match it.
6. `src/lib/oversight.ts`, `src/lib/prompt-io.ts`, `src/phase3-two-modes.ts` — the loop you are wrapping. Study how `createOversightGate({ mode, answers })` and the `AnswerProvider` interact.

## Hard guardrails (non-negotiable — violating any of these fails the phase)

1. **`book_flight` stays mocked.** No code path — including the new server — may import `@duffel/api` for booking or reach `.orders` / `orders.create` / `/air/orders` / `createOrder`. Booking flows only through the existing `src/lib/book-flight.js`. The one Duffel call in the whole system stays `duffel.offerRequests.create` (search), reached via the existing `searchFlights()`.
2. **Do not modify the tested core.** `src/lib/oversight.ts`, `rank-offers.ts`, `book-flight.ts`, `constraints.ts`, `normalize-offer.ts`, `search-flights.ts`, `offer-store.ts`, and every `*.test.ts` are **read-only** this phase. The trust boundary must stay exactly where its 29 tests prove it is. If you think you need to change one of them, **stop and ask** — that means the boundary is about to move.
3. **The web layer transports; it does not decide.** The browser must not contain any auto-vs-ask routing logic. It renders the gate's prompt and returns the human's choice (`"y"` / `"n"` / a number) in the *same contract* the CLI uses, so `oversight.ts` needs no change. All routing stays in `oversight.ts`.
4. **Scope = UX brief Part A only.** Logged-out, session-only, one page, no auth, no accounts, no database. Build **none** of Part B (accounts, earned-trust automation, async handoff, bookmarking, card vault).
5. **Keep it thin.** Over-built UI is a named PRD §9 risk. Spend the effort on the oversight surfaces (pre-action plan preview, escalation callout, honest mock confirmation), not on chrome.

## Stack (locked for this phase)

- **Frontend:** Vite + React + TypeScript + Tailwind + **shadcn/ui** (install via the shadcn CLI Vite path; do not add a second component/styling library — no MUI). Tokens per `design-system-prompt.md`. Custom components it calls out: date-range picker on `react-day-picker`, airport autocomplete on the shadcn Combobox (`cmdk` + Popover).
- **Server:** **Express**, run via `tsx` (matches the repo's no-build-step convention). Serves the built SPA in `phase4` mode; in dev, Vite serves the SPA and proxies `/api/*` to Express.
- Keep everything TypeScript, `NodeNext`, `strict` — consistent with `tsconfig.json`.

## The bridge you must build (this is the hard part — see HLD §4)

The oversight gate already takes an `AnswerProvider` (`src/lib/prompt-io.ts`) and awaits `answers.ask(prompt)`. Add a **third implementation** — a web provider — alongside the existing stdin and scripted ones. Do not edit the existing two; add a new one.

- `ask(prompt)` emits an SSE `escalation` event to the browser **and** parks its `resolve` in the run's state (leaves the promise pending). `canUseTool` awaits it happily — it already awaits stdin in Phase 3.
- `POST /api/decision { runId, answer }` looks up the parked resolver and calls it with the normalized answer, so the gate resumes and books-or-denies through the existing mock. `answer` is `"y"` / `"n"` / a number string — identical to the CLI contract.
- Wire it in exactly like the CLI does: `canUseTool: createOversightGate({ mode, answers: webProvider })`, with `book_flight` **left out of `allowedTools`** so every booking is forced through the gate (mirror `phase3-two-modes.ts` precisely).

Implement the API and SSE events per HLD §5. Render `OversightDecision` per HLD §6 (show `reason` verbatim; map `tier`/`outcome` to the success/warning/destructive tokens).

## Build sequence (each step ends demoable; commit per step)

1. **Scaffold + deps.** Add Vite/React/Tailwind/shadcn under `web/`, Express under `src/server/`, and the npm scripts (`dev:server`, `dev:web`, `dev`, `build:web`, `phase4`). `npm run typecheck` clean. Nothing wired yet.
2. **Server + bridge.** Express with `/api/run`, `/api/stream` (SSE), `/api/decision`; the run orchestrator wrapping `query()`; the web `AnswerProvider`. Prove the loop runs and streams to a `curl`/console client before any UI.
3. **SPA shell + tokens.** One page, the design-system tokens (light + dark), the three regions (chat / results / settings) laid out empty. Verify the visual language (white canvas, black controls, pill geometry) against `design-system-prompt.md`.
4. **Wire the surfaces.** Chat thread + loop stepper (§A5), result cards + constraint-status badges (§A3), constraints panel with impact hints (§A4), mode toggle defaulting to HITL (§A2b/e), the **pre-action plan preview** (§A2a — the hero), the **escalation callout** (§A2c), the honest **mock confirmation** (§A7), failure/empty states (§A6).
5. **End-to-end live run + re-verify.** Run both modes in the browser against live Duffel + live model. Then re-run CLAUDE.md §14 mock-boundary check **plus** grep the new `src/server/**` and `web/**` for any `@duffel/api` import or `.orders` reference (must be none). `npm test` still 29/29.
6. **BUILD-LOG.** Append a dated entry: what was built, the demo commands, verification results, open questions.

## Demo tuning (data wiring = live, per PRD §10.2 note)

Fares vary per take. To reliably hit the escalation beat, reuse Phase 3's approach: a tight budget on AUS→JFK lands an option in the `tolerance` tier (Phase 3 used ~420 USD total for `--scenario=escalate`). Keep the `--offline` fixture path reachable as a fallback for a guaranteed-clean recording.

## Acceptance criteria (Definition of Done — PRD §2, CLAUDE.md §7)

- Both **automated** and **HITL** modes run end-to-end in the browser against the live agent.
- The **pre-action plan preview** and **escalation callout** are visible and **truthful** — wired to the real `canUseTool` gate, not faked in the UI.
- Constraints are configurable and their effect is legible (impact hints).
- The **mock confirmation** renders and is unmistakably marked as simulated.
- CLAUDE.md **§14 mock-boundary check passes**, including the new server code — no reachable Duffel `order` path anywhere.
- `npm test` → 29/29; `npm run typecheck` clean.
- It is **screen-recordable**. That is the finish line, not feature completeness.

## When to stop and ask

- Anything that would require editing a file in guardrail #2.
- Anything that looks like Part B scope.
- Any temptation to put routing/decision logic in the browser.
- Any change to the locked stack or the mock boundary.

Recap at the end of each build step and get a lightweight go-ahead before the next, per CLAUDE.md §3.
