# HLD — Phase 4 Web UI (FlightGenie)

**Owner:** Alok · **Drafted:** 2026-07-20 · **Status:** For build
**Source of truth:** `Mini-PRD-Flight-Booking-Agent.md` (scope/guardrails), `UX-Interaction-Brief-Phase4.md` (behavior/flows), `design-system-prompt.md` (tokens/components). Where any of those disagree with this doc, they win — this is the *technical* layer only.
**Implements:** PRD §7 Phase 4. **Build brief:** `Claude-Code-Prompt-Phase4.md`.

---

## 1. Purpose

Give the finished Phase 3 agent (real Duffel search, deterministic constraint gate, `canUseTool` oversight boundary, mock booking) a thin web front end so the oversight model is visible in a browser and the whole thing is screen-recordable in both modes. This doc specifies *how the browser drives the existing agent loop* — the one non-trivial engineering problem in the phase. Everything else is UI assembly against an already-tested core.

The design centerpiece is unchanged from Phase 3: **the human can see, before it happens, when the agent will act on its own vs. pause and ask.** The UI renders that; it does not re-implement it.

## 2. Non-negotiables carried into this phase

These come from PRD §4 / CLAUDE.md §1 / UX brief §0 and bound every decision below.

| Guardrail | Consequence for this design |
|---|---|
| `book_flight` is always mocked; no reachable Duffel `order` path | The new HTTP layer calls the *same* `lib/book-flight.js`. No new Duffel client usage. §14 mock-boundary check re-run after wiring. |
| No real payment / ticketing / PNRs | Confirmation is the existing fabricated record, rendered honestly (UX §A7). |
| Logged-out, session-only, no auth | No login, no DB, no persisted user state. In-process, single-session server. |
| Trust boundary lives in code, not the prompt | The web layer **must not** re-implement routing. It only transports the gate's prompt to the human and the human's answer back. `oversight.ts` is untouched. |
| Keep it thin (over-built UI is a named PRD §9 risk) | One page, no router. Spend the budget on the oversight surfaces, not chrome. |

**Explicit rule:** `oversight.ts`, `rank-offers.ts`, `book-flight.ts`, `constraints.ts`, `normalize-offer.ts`, `search-flights.ts`, and the `*.test.ts` suite are **read-only** for this phase. If the build appears to need a change to any of them, stop and raise it — that's a signal the boundary is about to move.

## 3. System topology

```
┌─────────────────────────────┐         ┌──────────────────────────────────────────┐
│  Browser — React SPA (Vite) │         │  Node server (Express, run via tsx)        │
│                             │         │                                            │
│  Chat · Results · Settings  │         │   POST /api/run      ── starts a run       │
│  Escalation · Confirmation  │         │   GET  /api/stream   ── SSE: loop events   │
│                             │         │   POST /api/decision ── resolves the gate  │
│   EventSource ◀────────────────SSE────┤                                            │
│   fetch() ─────────────────────POST──▶│   ┌─ per-run orchestrator ──────────────┐  │
└─────────────────────────────┘         │   │ query() from @anthropic-ai/         │  │
                                        │   │ claude-agent-sdk, 4 tools,          │  │
                                        │   │ canUseTool = createOversightGate({  │  │
                                        │   │   mode, answers: WEB PROVIDER })    │  │
                                        │   └─────────────────────────────────────┘  │
                                        │        │ imports, in-process:               │
                                        │        ▼                                    │
                                        │   src/lib/*  (search-flights, rank-offers,  │
                                        │   oversight, book-flight [MOCK], offer-     │
                                        │   store, demo-fixtures)  ── UNCHANGED       │
                                        └────────────────┬───────────────────────────┘
                                                         ▼
                                              Duffel (search only) · Claude model
```

Single Node process. The SPA is served as static assets (Vite build) by the same Express server, or from the Vite dev server proxying `/api/*` in development. No second backend, no database.

## 4. The bridge (the crux) — SSE + a web `AnswerProvider`

Phase 3 already anticipated this. The oversight gate does not read stdin directly; it takes an `AnswerProvider` (`lib/prompt-io.ts`) and calls `answers.ask(prompt) → Promise<string>`. Two impls exist: real stdin, and a scripted queue for recordings. **We add a third.**

### 4.1 Web `AnswerProvider`

A per-run object implementing the same interface:

```ts
interface AnswerProvider {
  ask(prompt: string): Promise<string>;   // resolves with "y" | "n" | a number
  readonly scripted: boolean;             // false
}
```

`ask(prompt)` does two things:
1. Emits an SSE event to the browser: `{ type: 'escalation', prompt, options, offers }` (the human-facing decision surface).
2. Returns a promise and **parks its `resolve` function** in the run's state. It stays pending — the SDK's `canUseTool` is an async callback and will happily await a browser round-trip (exactly as it awaits stdin today).

When the browser POSTs `/api/decision`, the server looks up the parked `resolve` and calls it with the normalized answer string (`"y"`, `"n"`, or a number for HITL reselection). The gate resumes, applies its *existing* routing logic, and books-or-denies through the *existing* mock. The UI never contains any routing rules — it only renders the prompt and returns a choice, precisely matching the CLI's `y / n / number` contract so `oversight.ts` needs no change.

### 4.2 Why not WebSockets

Server→client is a one-way stream of events; client→server is a couple of discrete POSTs. SSE (`EventSource`) covers the stream with less ceremony than a socket, reconnection is built in, and it's trivial to render. Chosen for thinness. (If bi-directional interactivity grows later, revisit — not in v1.)

## 5. API contract

| Endpoint | Method | Body / params | Returns |
|---|---|---|---|
| `/api/run` | POST | `{ tripRequest, constraints, mode }` | `{ runId }`; kicks off `query()` server-side |
| `/api/stream?runId=` | GET (SSE) | — | event stream (below) |
| `/api/decision` | POST | `{ runId, answer }` where `answer ∈ "y" \| "n" \| "<number>"` | `{ ok: true }`; resolves the parked gate promise |

`tripRequest` may be the raw natural-language string (model does intake) **or** structured fields the UI assembles into the prompt; `constraints` mirrors the `rank_offers` params (`maxPrice`, `currency`, `maxStops`, `maxTotalDurationMinutes`, `preferredAirlines`, `budgetTolerancePct`). `mode ∈ 'automated' | 'hitl'`.

### 5.1 SSE event types (server → browser)

Each maps to an existing artifact of the loop; the UI renders, never derives.

| `type` | Payload | UI surface |
|---|---|---|
| `loop_step` | `{ label: 'searching' \| 'ranking' \| 'deciding' }` | Thinking-state stepper in the thread (UX §A5) |
| `assistant_text` | `{ text }` | Agent narration in the chat thread |
| `offers` | `{ eligible[], tolerance[], rejected[] }` from `classifyOffers` | Result cards + constraint-status badges (UX §A3) |
| `plan_preview` | `{ mode, message }` | Pre-action plan banner — **the hero** (UX §A2a) |
| `escalation` | `{ prompt, options[], offers[] }` from the web provider | Escalation callout / HITL approval overlay (UX §A2c) |
| `decision` | one `OversightDecision` (see §6) | Updates the oversight trace + card state |
| `confirmation` | the mock `BookingResult` | Honest mock-confirmation overlay (UX §A7) |
| `error` | `{ message }` | Failure/empty states (UX §A6) |
| `done` | `{ decisionLog: OversightDecision[] }` | Final oversight trace |

## 6. Rendering the oversight model

The gate emits a structured record per booking decision — render it directly, do not re-derive. Shape (from `lib/oversight.ts`, authoritative):

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
  reason: string;             // the legibility payload — show this verbatim
  finalOfferId?: string;      // set when the human reselected
  humanPrompt?: string;
  humanAnswer?: string;
}
```

`getDecisionLog()` returns `OversightDecision[]`. Token mapping the UI must honor (from UX §A2c / §A3, design system semantic tokens):

| `tier` / `outcome` | Token | Meaning shown |
|---|---|---|
| `eligible` | **success** (muted green) | "Meets all your rules" |
| `tolerance` | **warning** (amber) | "Close — slightly over budget"; the escalation case |
| `rejected` | **destructive** (red) | "Breaks: `<rule>`"; de-emphasized, not bookable |
| `outcome: allow` | success accent | acted / approved |
| `outcome: deny` | warning (escalate) or destructive (hard block) | paused / blocked |

The pre-action plan preview (§A2a) is keyed off `mode` *before* any decision arrives — automated: "I'll auto-book the best option that meets all your rules; if nothing qualifies I'll stop and ask." HITL: "I'll find and rank options — you make every booking call."

## 7. Run lifecycle

**Automated, happy path:** `/api/run` → `loop_step: searching` → `offers` → `loop_step: deciding` → gate sees `eligible` → allows with no human → `decision(auto-book)` + `confirmation` → `done`. No `escalation` event fires.

**Automated, escalation beat:** best option is `tolerance` → gate calls `answers.ask()` → server emits `escalation` and parks the resolver → UI shows the callout with `Approve anyway / Adjust constraint / See alternatives` → user POSTs `/api/decision` → gate resumes → `decision(escalated-approved|declined)` (+ `confirmation` if approved) → `done`.

**HITL:** every bookable pick pauses. `offers` renders preferred + secondaries → gate emits `escalation` (approval overlay with the numbered selectable set) → user answers `y` / `n` / number → reselection rewrites the booked offer via the gate's existing `updatedInput.offerId` path → `decision(hitl-approved|declined)` → `done`.

Mode switch mid-run (UX §A2d): re-present the pending decision under the new mode's rules; require one explicit confirm; never silently auto-book a pending item. Implement as: cancel the parked promise as a decline, surface a "mode changed — re-evaluating" note, and let the next gate call re-drive.

## 8. Session state

All UI state (mode, constraints, thread, pending decision) lives in React state / `sessionStorage` so it *behaves* persistent within one recording (UX §A9). No server-side persistence, no `localStorage` requirement, no account. Server keeps only an in-memory `Map<runId, RunState>` holding the live `query()` iterator and the parked gate resolver; entries are dropped on `done`/`error`.

## 9. Mock boundary — preservation & re-verification

The new code touches HTTP, not booking. `book_flight` still resolves to `lib/book-flight.js`, which imports nothing from `@duffel/api`. After the server is wired, re-run CLAUDE.md §14 verbatim:

1. `grep -rn "orders\.\|orders\.create\|/air/orders\|createOrder" src/` → only hit is the forbidden-pattern list in `book-flight.test.ts`.
2. `grep -n "from '@duffel/api'" src/lib/book-flight.ts` → nothing.
3. `npm test` → book-flight static self-scan + behavioral tests pass; oversight routing 29/29 unchanged.
4. Confirm the only Duffel method invoked anywhere is `duffel.offerRequests.create` (search). The new server adds **no** Duffel client usage of its own — it calls `searchFlights()` from `lib/`.

Add one server-level assertion to the checklist: grep the new `src/server/**` for any `@duffel/api` import or `.orders` reference → must be none. Booking flows through `lib/book-flight.js` only.

## 10. Proposed file layout (additive; nothing existing is edited)

```
src/
  lib/                         UNCHANGED (read-only this phase)
  phase3-two-modes.ts          UNCHANGED (CLI stays as a fallback demo path)
  server/
    index.ts                   Express app: static serve + /api routes
    run-orchestrator.ts        wraps query(); wires the web AnswerProvider; emits SSE
    web-answer-provider.ts     the 3rd AnswerProvider (SSE out, /api/decision in)
    sse.ts                     tiny SSE helper (event framing, per-run channel)
web/                           Vite + React + Tailwind + shadcn SPA
  src/
    App.tsx                    one page, no router
    components/                chat, result cards, settings, escalation, confirmation
    lib/theme.ts               tokens from design-system-prompt.md (shadcn CSS vars)
package.json                   + react, vite, tailwind, express, shadcn deps + scripts
```

New npm scripts (indicative): `dev:server`, `dev:web`, `dev` (both), `build:web`, `phase4` (serve built SPA + API).

## 11. Risks & open questions

| Risk / question | Handling |
|---|---|
| Live model + live Duffel = non-deterministic fares per take | Tune the demo prompt's budget to reliably land a `tolerance` option (Phase 3's `--scenario=escalate` used 420 USD on AUS→JFK). Keep the `--offline` fixture path available as a fallback for a guaranteed-clean take. |
| `canUseTool` holding open on a browser round-trip | Verified pattern: it already awaits stdin arbitrarily in Phase 3. Web provider is the same await, different transport. |
| SSE + a long model turn (seconds of latency) | The `loop_step` stepper (UX §A5) turns dead time into visible reasoning — a feature, not a wait. Send a heartbeat comment to keep the SSE connection warm. |
| Mode switch mid-decision | §7 rule: re-present, one explicit confirm, never silent auto-book. |
| Scope creep into Part B (accounts, earned trust, async handoff) | Hard-blocked. Part B is documented-vision only; the build brief repeats this. |
| shadcn in a Vite (non-Next) project | Supported — shadcn is framework-agnostic (Tailwind + CSS vars). Build brief pins the Vite setup path. |

## 12. Definition of done (this phase)

Per PRD §2 / CLAUDE.md §7: both modes run end-to-end in the browser against the live agent; the pre-action plan preview and escalation callout are visible and truthful (wired to the real gate); constraints are configurable and their effect is legible; the mock confirmation renders honestly; and the §14 mock-boundary check passes with no reachable Duffel `order` path — including in the new server code. Screen-recordable is the finish line, not feature completeness.
