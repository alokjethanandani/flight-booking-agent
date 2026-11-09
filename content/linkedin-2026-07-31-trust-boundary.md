# LinkedIn draft 3: Defining booking permission

Original planned publication date: July 31, 2026. Status: Draft. Publication is not confirmed here.

Audience: design hiring managers, recruiters, product managers, and engineering managers.

## Publication checklist

- [ ] Verify each claim against the current implementation.
- [ ] Add the planned image or recording. Keep simulated booking clearly labeled.
- [ ] Publish the article and replace `[link to article]` in the feed post.
- [ ] Add the discussion question as the first comment.

## Feed post

Where should an AI agent's permission to act be enforced?

For FlightGenie, I put booking permission in a code gate that runs before the booking tool executes.

The agent searches live flights and checks the user's budget, stops, and duration. Automated mode can simulate booking for eligible offers. Manual review requires approval for every bookable offer.

An offer up to 20% over budget can reach the user for approval if the other hard constraints pass. A rejected offer stays blocked in both modes.

The browser shows the plan before action and presents the approval request when the gate pauses. Its role is to make the permission boundary visible and carry the user's answer back.

I kept the core gate and its tests unchanged while adding the browser. The booking tests check the simulated implementation and scan it for real-order patterns.

Search is live. Every booking is simulated.

[link to article]

#AgenticAI #ProductDesign #HumanInTheLoop #DesignLeadership

## First comment

Which agent permissions do you enforce in code, and which still depend on model instructions?

## Article

## How I defined an agent's booking permission

I put FlightGenie's booking permission in code before adding the browser interface. The model could recommend a flight, but a separate gate decided whether the booking tool could execute.

I chose flights because budget, stops, and duration made that decision visible. Search used live airline offers. Booking always returned a simulated confirmation.

[IMAGE: eligible, over-budget, and rejected cards. Caption: "Each tier has a different permission rule."]

### 1. Give exceptions a defined path

I used three tiers:

| Tier | Check | Permission |
|---|---|---|
| Eligible | Configured hard constraints and budget pass | Automatic in automated mode. Approval in manual review |
| Tolerance | Up to 20% over budget with other hard constraints met | Approval required in both modes |
| Rejected | A required check fails or the offer exceeds tolerance | Blocked in both modes |

The tolerance tier kept a near-budget option available without silently expanding the price cap. Approval applied only to that defined exception. It could not override a rejected offer.

Code enforced the numeric checks. The model interpreted the trip and explained its recommendation. Time windows mentioned in a request were outside the deterministic gate.

Design criterion: an exception can reach a reviewer without becoming permission to bypass every rule.

### 2. State permission before action

I placed a plan before the search and booking flow. It stated whether the agent could book automatically or needed approval.

Manual review was the default. I wanted users to inspect a recommendation before enabling automatic booking. Switching modes during a run applied to the next search.

The approval request used warning styling and named the budget exception. Rejected offers remained visible for inspection without a booking action.

Design criterion: users can identify the approval policy before the agent attempts to book.

### 3. Keep the interface tied to the gate

The gate recorded each booking decision with its mode, tier, action, outcome, and reason. The browser showed a shorter sentence for known actions and retained the original prompt for inspection.

During the browser build, I kept the gate and its tests unchanged. Existing checks covered routing, simulated results, expiry, and forbidden real-order patterns in the booking module.

The receipt stated that no ticket was issued and no card was charged. Its cancellation control changed the displayed simulation only.

Design criterion: the UI accurately describes the permission granted and the action that occurred.

[VIDEO: automated mode proposes an over-budget offer, waits for approval, and returns a simulated confirmation.]
