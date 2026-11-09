# Interaction brief: FlightGenie Phase 4

Owner: Alok Jethanandani. Drafted: July 14, 2026. Status: Design intent with implementation notes.

Source of truth: [product brief](Mini-PRD-Flight-Booking-Agent.md) for scope. The [technical design](HLD-Phase4-Web-UI.md) records the current browser contract. Use the [design-system prompt](prompts/design-system-prompt.md) for tokens and components.

## Purpose, success criteria, and risks

Make the agent's booking permission visible before it acts. Each approval request should explain the exception and give the user a clear next step.

This brief records the intended interactions. Implementation notes distinguish working behavior from proposals. Success criteria and risks live in product brief §2 and §9, and technical design §11 and §12.

## 0. Scope and guardrails

Booking is simulated in every mode. The receipt uses a fabricated reference and PNR. It must state that no ticket was issued and no card was charged.

v1 has no accounts, authentication, stored payment, or durable preferences. Keep the interface focused on trip intake, classification, approval, and confirmation.

## Part A: v1 interactions

### A1. Screen inventory

Use one page without routing. The implemented app places results and approval cards in the chat feed.

| Surface | Responsibility |
|---|---|
| Trip intake | Accept the user's route, dates, and budget |
| Chat feed | Show questions, progress, results, and decisions |
| Settings | Set mode, stops, duration, airline, cabin, and passengers |
| Approval card | Show the proposed offer and await a decision |
| Confirmation | Show the simulated receipt |

Use the design system's responsive rules. The original split-pane layout remains an option rather than an implemented requirement.

### A2. Oversight model

Render the core's decision data. The browser carries questions and answers while the server-side gate owns booking permission.

The authoritative `OversightDecision` type includes mode, tier, outcome, action, and reason. Final outcomes are `allow` and `deny`. An `escalation` event represents a pending human decision.

#### A2a. Pre-action plan

Show the approval policy before tool execution:

- Automated: "I'll simulate booking when an option meets your configured rules. Over-budget options within tolerance need your approval."
- Manual review: "I'll find and rank flights. Every simulated booking needs your approval."

Design criterion: the user can tell what requires approval before a booking attempt.

#### A2b. Mode control

Offer manual review and automatic booking in Settings. Explain each mode beside the control. Both modes block rejected offers.

#### A2c. Approval and escalation

Use warning styling for an over-budget approval request. Use alert styling for a hard rejection. Name the relevant constraint and the proposed offer.

The intended action row supports approval, adjustment of the relevant constraint, and alternatives. The current card supports approval, decline, and manual-review reselection. Direct links to individual settings remain design intent.

A hard rejection cannot be approved. The user must change the relevant constraint and search again.

#### A2d. Mode changes during a run

The implemented mode change applies to the next search. Show that message while a run is active.

The earlier proposal re-presented a pending decision under the new mode. It is not implemented. Do not describe a pending approval as automatically re-evaluated.

#### A2e. Default mode

Start each new session in manual review. I chose this default so users can review the recommendation before granting automatic booking permission.

### A3. Flight result cards

Show airline, price, currency, stops, total duration, and itinerary details where available. Use text labels alongside semantic color.

| Tier | Treatment | Label |
|---|---|---|
| Eligible | Success | Meets your configured rules |
| Tolerance | Warning | Over budget. Approval required |
| Rejected | Alert and reduced emphasis | Does not meet a required rule |

Keep the preferred offer visually distinct. Current result cards follow the classifier's default sort, while the approval card follows the model's requested offer. These can differ.

"Why this rank" currently reveals classification reasons. The model's recommendation explanation appears in the chat. A close-call signal remains design intent.

### A4. Constraints panel

The budget comes from the trip request. Settings hold maximum stops, total duration, airline preference, cabin, and passenger count.

Explain that round-trip duration sums both flight legs. Preferred airline is soft unless the user selects "Only use this airline". That option filters other carriers on the server.

The panel shows the last search's tier counts. Live impact hints during constraint editing remain design intent. Do not imply that a pending run uses edited values.

### A5. Progress states

Show "Searching flights", "Checking your rules", and "Reviewing options" as tool events arrive. These states describe execution progress. They do not expose the model's internal reasoning.

### A6. Failure and empty states

| State | Response |
|---|---|
| No bookable offers | Show the active constraints and offer rule adjustment or another search |
| Provider search error | Describe the failed search and provide retry |
| Expired fare | Explain that the fare expired and a new search is required |
| Missing trip information | Ask a specific question and wait for an answer |

Do not promise a completed retry before it happens. Automatic recovery depends on subsequent agent behavior.

### A7. Simulated confirmation

Show route, fare, itinerary, passenger count, and fabricated reference. Label the PNR as simulated.

Keep this disclosure visible: "Simulated booking. No ticket was issued and no card was charged."

A cancel control updates the displayed simulated receipt. It does not represent a real cancellation policy or refund guarantee.

### A8. Pending-decision visibility

Design intent: keep a pending approval easy to find with a "1 decision needs you" indicator that returns to the card. The current app shows the approval inline without a separate sticky indicator.

### A9. Session preferences

Keep mode, constraints, and feed in React state. Reload resets them. Theme preference uses `sessionStorage`. No account is required.

### A10. Component states

Cover default, hover, focus, disabled, loading, and error states where relevant. Make allowed actions, pending approvals, and blocked offers distinguishable through text as well as color.

## Part B: product vision beyond v1

The [logged-in vision](Vision-Brief-Logged-In.md) explores persistent preferences and standing rules. These are static concepts outside the working agent.

| Concept | Product question |
|---|---|
| Persistent preferences | Which inputs should carry across trips? |
| User-approved automation suggestions | When should repeated choices prompt a scoped rule? |
| Multichannel approval | How could a user resume a decision away from the browser? |
| Bookmarks | How could a traveler compare offers across sessions? |

Payment and identity concepts belong only in the separate static vision. Do not add a payment vault, real credentials, or account flows to v1.

## Resolved decisions

The app name is FlightGenie. The pre-action plan is the primary interaction for the case study because it states permission before execution.
