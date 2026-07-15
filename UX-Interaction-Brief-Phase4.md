# UX / Interaction Brief — Phase 4 UI (FlightGenie)

**Owner:** Alok · **For:** Claude Design (AI designers) · **Drafted:** 2026-07-14 · **Status:** For design
**Companion doc:** `design-system-prompt.md` (tokens + components — the *system* layer). This brief is the *behavior* layer: flows, states, and the oversight interaction model. Read both.
**Source of truth:** `Mini-PRD-Flight-Booking-Agent.md`. Where this brief and the PRD disagree, the PRD wins.

---

## 0. Read this first — hard guardrails (non-negotiable)

This is a **screen-recordable POC**, not a product. Three rules bound every design decision:

1. **Booking is mocked.** No real payment, no real ticket, no PNR. The confirmation is fabricated (`MOCK-` ref, fake 6-char code, `mock: true`). The UI must be *honest* that it is simulated — see §A7.
2. **No accounts, no auth, no stored payment.** v1 is logged-out and session-only. Do **not** design a signup wall, a login screen, or a saved-card vault. (Account model is documented in Part B as vision — not built.)
3. **Keep it thin.** The star is the *oversight model* (when the agent acts vs. asks), not visual richness or feature breadth. PRD §9 names "over-built UI steals focus" as a live risk. When in doubt, cut.

**What this artifact exists to prove:** that a human can *see, before it happens*, when the agent will act on its own vs. pause and ask — and can trust or override that boundary. Every screen serves that.

---

## PART A — V1 DEMO SCOPE (BUILD THIS)

### A1. Screen inventory

One page, no routing. Three persistent regions + two overlays:

| Region | Role | Mobile | Laptop |
|---|---|---|---|
| **Chat thread** | Natural-language intake + agent narration of the loop | Full-width, stacked above results | Left pane |
| **Results area** | Preferred + secondary flight cards | Stacks under chat | Right pane |
| **Settings** (mode + constraints) | The control surface / guardrails | Sheet/drawer | Side panel or dialog |
| **Escalation callout** (overlay) | "I paused because…" | Inline card in thread | Inline card in thread |
| **Mock confirmation** (overlay) | Simulated booking receipt | Dialog / full-screen sheet | Dialog |

Defer all responsive token/breakpoint detail to `design-system-prompt.md`. Don't re-specify it here.

### A2. The oversight model (the centerpiece — spend your design budget here)

The agent already emits a structured decision record per run. Build the UI to render it directly. Shape (from `src/lib/oversight.ts`, `OversightDecision`):

```
{ mode, tier, outcome, action, reason, humanQnA?, reselection? }
  mode:    'automated' | 'hitl'
  tier:    'eligible' | 'tolerance' | 'rejected' | 'unknown'   // per offer
  outcome: 'allow' | 'escalate' | 'deny' | 'pause'
  action:  what the agent did / is about to do
  reason:  human-readable "why"
```

Expose it via `getDecisionLog()`. **The UI's job is to make `outcome` visible and legible — ideally before it happens.**

**A2a. Pre-action plan preview (the differentiator).**
Before the agent acts, show what it *will* do without asking. A short banner at the top of the results area, keyed off mode:
- Automated: *"I'll auto-book the best option that meets all your rules. If nothing qualifies, I'll stop and ask."*
- HITL: *"I'll find options and rank them — you make every booking call."*
The boundary must be visible *before* it's crossed, not explained after. This one pattern is what separates "designed for oversight" from "a chatbot with buttons."

**A2b. Mode toggle.**
A `switch`/segmented control in Settings with a one-line inline explanation of each mode (copy above). Changing mode mid-session is allowed (§A2d). Default = **HITL** (see §A2e).

**A2c. Escalation callout** — the "I stopped because X" surface. Fires when `outcome = escalate` (automated mode, best option is `tolerance` tier) or `deny`.
- **Tone:** attention-needed, *not* a hard error. Use the `warning` token, not `destructive`, for escalations; reserve `destructive` for `deny`/hard-broken constraints.
- **Anatomy:** icon + one-line reason (`"I paused — this breaks your rule: max 1 stop"`) + the offending constraint named explicitly + **action row**.
- **Action row (required):** `Approve anyway` · `Adjust the constraint` (deep-links to the relevant field in Settings) · `See alternatives`. Never a dead end.
- Maps to the SDK `canUseTool` gate — the pause is a runtime guarantee, so the callout is always truthful.

**A2d. Mode switching mid-task.** If the user flips HITL→automated while a decision is pending, don't silently auto-book the pending item. Re-present it under the new mode's rules and require one explicit confirmation. Show a small "mode changed — re-evaluating" note in the thread.

**A2e. Default = HITL.** New/session-first users start in human-in-the-loop. Rationale for the designer: trust is earned, not granted; and HITL surfaces the oversight/escalation moments every run (that's the demo payoff). Automated is one toggle away — sequence it, don't hide it.

### A3. Flight result cards

- **Preferred pick** gets a distinct, elevated treatment (badge + border/emphasis) vs. secondary options. One preferred, N secondaries.
- **Constraint-status badge** on every card, driven by `tier` → token:
  - `eligible` → **success** ("Meets all your rules")
  - `tolerance` → **warning** ("Close — slightly over budget")
  - `rejected` → **destructive** ("Breaks: max 1 stop") — and de-emphasize; a rejected offer is not presented as bookable.
- **"Why this rank"** via progressive disclosure: collapsed badge → expand → the agent's `reason`. Don't dump reasoning inline; let the user pull it.
- Card content: airline, times, stops, duration, price (per `design-system-prompt.md` flight-card spec).
- **Confidence signal:** when the agent's top pick is a close call (e.g., preferred and #2 are near-tied), surface a light "close call" note so a confident pick and a tentative one don't look identical.

### A4. Constraints panel — guardrails, not a form

This is the "safe by construction" story made tangible (PRD §8). Design constraints as *guardrails the user sets*, not a settings dump:
- Fields: budget, max stops, max total duration, preferred airline(s), cabin, passengers.
- **Impact hint on edit:** when a constraint tightens, show its effect — *"1 stop max removes 4 of 6 options."* Makes the guardrail→outcome link visible.
- Preferred airline is a **soft** preference (per PRD) — label it so, since automated mode may auto-book a non-preferred eligible offer. Don't imply it's a hard filter.

### A5. Agent-loop legibility — thinking states, not a spinner

Duffel search + model latency is real (seconds). The loop being visible *is* the agent literacy you're demonstrating. Instead of one spinner, narrate the loop in the thread:
`Searching flights…` → `Ranking against your rules…` → `Deciding…` → result.
Each step is a lightweight state (skeleton on cards, stepper in thread). This turns dead wait time into proof the agent is reasoning, not guessing.

### A6. Failure & empty states

- **No offers meet constraints:** not a dead end — offer to relax a specific constraint (name which one is binding) or re-search dates.
- **Duffel returns nothing / search error:** honest "couldn't reach live fares" with retry.
- **Offer expired** (already built in Phase 3 — `offer_expired`): surface as an *oversight moment*, not an error — *"That fare expired while we talked. Re-searching…"* This is a cheap, realistic trust beat; use it.

### A7. Mock-booking confirmation (honest simulation)

The confirmation is fabricated. Design it to be *unmistakably simulated* without breaking the flow:
- Render the receipt (route, times, price, fake ref) so the flow feels complete.
- Persistent, clearly-styled **"Simulated booking — no ticket was issued, no card was charged"** marker (use `info`/muted, not hidden in fine print).
- Include a **cancel/undo** affordance even though it's mocked — signals the reversibility value in a POC where nothing is truly reversible.

### A8. Resumability (in-session)

When the agent pauses in HITL, the pending decision must not get lost in scroll. Provide a lightweight **"1 decision needs you"** indicator (badge on results area / sticky pill) that scrolls to the escalation callout. This is the in-session, no-infra version of the async handoff described in Part B.

### A9. Session preferences (no auth)

Hold mode + constraint choices in session/local state so they *behave* persistent within one recording. No login, no server, no account. Do not design an auth flow to enable this.

### A10. Interaction-state coverage

Every interactive component ships all states: default · hover · focus · disabled · loading · error (per `design-system-prompt.md`). This brief adds one product-specific state set — **the oversight outcomes** (`allow` / `escalate` / `pause` / `deny`) must each have a distinct, legible visual treatment wired to the semantic tokens.

---

## PART B — PRODUCT VISION (DO NOT BUILD IN v1)

Documented for the portfolio/interview narrative and to keep the AI designer from accidentally scoping these into the thin demo. **None of this ships in v1.** All are PRD §3 non-goals or beyond.

- **Account model + persistent preferences.** Where stored mode/airline/cabin/seat prefs live across sessions, and where the *trust-calibration* narrative belongs. This is the strategically interesting extension — preferences are the trust-boundary inputs. (v1 fakes persistence in session state.)
- **Progressive / earned trust.** Start HITL; after N confirmed bookings or per-route, the agent *offers* to automate: *"I've picked what you'd pick 3 times running — auto-book under $X on this route?"* Trust calibration made literal. Requires the account model above, so vision-only.
- **Async multichannel handoff.** SMS / WhatsApp / email to resume a paused decision away from the browser. The in-session version (§A8) is the only part built in v1.
- **Bookmarking flights** for comparison shopping across sessions.
- **CUT — stored card / payment vault.** Explicitly not designed, not even mocked. Booking is simulated; simulating a card vault signals PCI/liability and contradicts the "no financial actions, ever" guardrail. Do not include in vision *or* demo.

---

## Resolved decisions
- **App name:** **FlightGenie** — confirmed for demo and portfolio.
- **Hero interaction:** the pre-action plan preview (§A2a) is the **hero interaction for the case study** — prototype it to the highest fidelity and build the demo screens to showcase it. It's the clearest single expression of "designed for oversight."
