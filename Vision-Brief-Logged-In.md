# Product vision: logged-in FlightGenie

Owner: Alok Jethanandani. Drafted: July 14, 2026. Status: Static concept beyond v1.

Source of truth: [product brief](Mini-PRD-Flight-Booking-Agent.md) for the working agent's scope. This brief extends [interaction brief Part B](UX-Interaction-Brief-Phase4.md#part-b-product-vision-beyond-v1). Use the [design-system prompt](prompts/design-system-prompt.md) for visual rules.

## 0. Scope and guardrails

This concept explores persistent preferences and standing booking rules. None of it connects to the Phase 4 agent.

All identity, payment, trip, and activity data is fictional. Prototype controls change the display only. Never collect real card numbers, credentials, or identity documents for this concept.

Keep the existing visual system: white canvas, Inter, black controls, orange accent, semantic status color, pill geometry, and light and dark themes.

## 1. Purpose

I designed the logged-in concept around scoped permission. A saved preference can reduce repeated input, but it does not grant authority to spend money.

The user must approve each automation rule and see its route, conditions, spend cap, and fallback. Repeated behavior can justify suggesting a rule. It cannot authorize that rule on its own.

Design criterion: the user can inspect, limit, and pause each grant of automation.

## 2. Information architecture

| Area | Responsibility | Review needs |
|---|---|---|
| Home | Upcoming trips, active rules, and activity | Identify actions awaiting approval |
| Chat and search | Request a trip with saved preferences | Show which preferences apply |
| Travel profile | Airlines, airports, cabin, seat, and meal | Allow quick correction |
| Traveler and IDs | Fictional identity and loyalty records | Confirm identity changes |
| Payment | Masked sample cards and spend caps | Show the link between money and permission |
| Automation and trust | Mode, scoped rules, and notifications | Require explicit approval for expanded authority |

## 3. Stored preferences

Scale friction to impact, reversibility, and novelty.

| Data | Examples | Intended interaction |
|---|---|---|
| Search preferences | Airports, cabin, seat, airline | Apply defaults and let the user correct them |
| Identity | Loyalty number, passport, Known Traveler Number, companions | Confirm edits and identify affected travelers |
| Money and authority | Sample card, per-trip cap, monthly cap, booking rule | Require explicit approval and show the resulting permission |

These are proposed interactions. The static prototype provides no secure storage or identity verification.

## 4. Payment concept

Show masked sample card details only, such as `Visa ••42`. Pair each card with a spend cap and the rules that reference it.

A spend cap limits exposure but does not make every booking appropriate or reversible. The concept must also show the route, traveler, conditions, and approval fallback.

Provide a visible "Pause all automatic booking" control. In this prototype, it only changes the display.

Design criterion: adding a card never silently enables automatic booking.

## 5. Automation and trust

Start with manual review. Let the user create a route-specific rule with explicit conditions.

Illustrative rule:

> Auto-book AUS to SFO, round-trip, under $350, with at most 1 stop, using Visa ••42. Otherwise, ask me.

If an airline is required, say so explicitly. A soft preference must not appear to be a mandatory condition.

A repeated-choice prompt can suggest the same rule:

> You've chosen this AUS to SFO pattern 3 times. Create an automatic-booking rule under $350?

The amounts and counts are fictional examples, not observed behavior or research findings. The user must approve the proposed rule before it becomes active.

Design criterion: similar past choices can trigger a suggestion, never an automatic expansion of authority.

## 6. Activity and reversibility

Show a record of each action with the matched rule, fare, and outcome. State the applicable permission before action through a personalized plan.

Illustrative activity entry:

> Simulated booking: AUS to SFO, $312, within your $350 cap. View details.

Do not imply that every ticket supports undo. A future product would need to state actual cancellation terms before purchase. The static prototype's undo control demonstrates an interaction only.

Design criterion: users can trace each automatic action to the rule that allowed it.

## 7. Onboarding

Let users search before completing a profile. Offer to save preferences in context, such as a home airport after a search.

Keep optional profile setup available. Ask for identity or payment information only when a supported task requires it in a future implementation.

## 8. Prototype screen plan and acceptance criteria

| Priority | Screen | Demonstration |
|---|---|---|
| 1 | Home | Upcoming trip, active rules, and activity |
| 2 | Automation and trust | Scoped rules, approval, and a repeated-choice suggestion |
| 3 | Payment | Masked sample cards, caps, and pause control |
| 4 | Travel profile | Airline, airport, seat, and cabin preferences |
| 5 | Traveler and IDs | Fictional loyalty, identity, and companion records |

Acceptance requires all 5 screens in light and dark themes, with fictional data and an explicit concept label. No control may create a real transaction.

## 9. Portfolio framing

The working agent demonstrates booking permission for a single session. This concept explores how a user could grant limited, standing permission across trips.

Present the two artifacts separately. The concept shows a proposed oversight model, not a launched account or payment system.

## 10. Risks and open questions

| Question | Risk to resolve before implementation |
|---|---|
| Can the agent suggest nearby airports? | A cheaper route may violate an unstated travel need |
| Do rules apply to companions? | Authority for one traveler may not cover another |
| Which rule wins when several match? | Conflicting permissions can produce an unexpected booking |
| What can be cancelled? | Reversibility depends on the actual fare terms |
| How should unusual trips be reviewed? | Familiar route patterns may conceal new stakes |
