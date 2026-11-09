# Phase 4 publishing drafts

Three feed posts and three articles about the browser build. The dated drafts carry the publication checklists. These are alternatives, not published results.

Audience: design hiring managers, recruiters, product managers, and engineering managers. Search is live in every described demo. Booking is simulated.

## Feed A: connecting browser approval

I connected a browser to my flight-booking agent through the same interface I had used for terminal approval.

The agent searches live fares and checks them against the user's constraints. Automated mode can simulate booking for an eligible offer. Manual review requires approval for every bookable offer.

In Phase 3, I separated human input from booking permission. One interface asked a question and waited for an answer. Keyboard input and scripted replies already used it.

For the browser, I added another implementation. It sent the question to the screen, waited for the user's answer, and resumed the existing gate.

That kept permission policy in one place. I could add a new input surface without rewriting the rule that decides whether booking can proceed.

Search uses live data. Every booking is simulated.

[link to article]

#ProductDesign #AgenticAI #BuildingInPublic #DesignEngineering

## Feed B: revising a recorded decision

I changed a recorded technical decision after checking it against the deliverable.

My original spec put FlightGenie's interface in v0/Lovable. The deliverable was a screen-recorded demo of a live agent, so I reconsidered that choice.

I built the UI in the repository with React and an Express bridge. That let the browser connect directly to the existing search, classification, and approval flow.

I recorded the override with its rationale. The product scope stayed the same: live flight search, two approval modes, and simulated booking.

The written decision gave me something specific to revise. I could explain which assumption had changed and which constraints still held.

[link to article]

#ProductManagement #ProductDesign #BuildingInPublic #AgenticAI

## Feed C: defining booking permission

Where should an AI agent's permission to act be enforced?

For FlightGenie, I put booking permission in a code gate that runs before the booking tool executes.

The agent searches live flights and checks the user's budget, stops, and duration. Automated mode can simulate booking for eligible offers. Manual review requires approval for every bookable offer.

An offer up to 20% over budget can reach the user for approval if the other hard constraints pass. A rejected offer stays blocked in both modes.

The browser shows the plan before action and presents the approval request when the gate pauses. Its role is to make the permission boundary visible and carry the user's answer back.

I kept the core gate and its tests unchanged while adding the browser. The booking tests check the simulated implementation and scan it for real-order patterns.

Search is live. Every booking is simulated.

[link to article]

#AgenticAI #ProductDesign #HumanInTheLoop #DesignLeadership

## Article A

## How I connected browser approval to an existing agent

I connected FlightGenie's browser through the same human-answer interface I had used in the terminal. That preserved the existing booking permission gate while adding a new way to approve a recommendation.

The agent searches live flight offers. It can simulate booking automatically for eligible offers or ask for approval, depending on the selected mode. All bookings remain simulated.

[IMAGE: mode control and an approval request. Caption: "Browser approval uses the existing permission gate."]

### 1. Separate the question from its input surface

In Phase 3, I gave the gate an `AnswerProvider` with one method: `ask(question)`. It returned a promise containing the answer.

Keyboard input supported live runs. A scripted queue supported repeatable human replies during recordings. Neither implementation owned booking policy.

For the browser, I added a third provider rather than adding browser-specific rules to the gate.

Design criterion: a new input surface can answer the question without changing permission policy.

### 2. Keep the gate waiting for the answer

The web provider sent the question over Server-Sent Events and kept the promise pending. When the user approved, declined, or selected another offer, the browser posted the answer to the server.

The server resolved the promise. The gate resumed and applied its existing rules.

I chose SSE because the server sent a stream of updates while the browser returned discrete answers. HTTP POSTs covered the return path.

Design criterion: the booking tool cannot proceed while required approval is pending.

### 3. Preserve the core during UI work

I treated classification, oversight, simulated booking, and their tests as read-only during Phase 4. The browser work added transport and presentation around them.

The result cards used the classifier's default sort. The approval card showed the requested offer. This distinction matters because model recommendations can differ from the default first result.

The tests checked current routing and the simulated booking implementation. They provided evidence for those checks, not proof against every future integration error.

Design criterion: the browser carries the user's choice while the core remains responsible for permission.

[VIDEO: show a pending browser approval followed by the simulated confirmation. Keep the simulation label visible.]

## Article B

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

## Article C

## How I revised a spec while preserving its constraints

I changed FlightGenie's UI plan after checking it against the deliverable. The original spec selected v0/Lovable. A local React interface gave me a direct path to recording the running agent.

I recorded the change on July 20, 2026. Live flight search, two approval modes, and simulated booking remained the scope.

[IMAGE: the recorded UI decision and override. Caption: "The changed decision and its rationale stay with the project."]

### 1. Define the contract before building the interface

I wrote the browser-to-agent contract before implementing the UI. It named the API routes, event payloads, human-answer interface, and core files that would remain unchanged.

That made the work reviewable. I could compare the implementation with specific responsibilities instead of accepting an interface that only looked plausible.

Design criterion: each layer has a named responsibility and an observable output.

### 2. Revise the decision against the actual goal

The deliverable was a recorded demo. I did not need hosted-builder deployment to show the oversight flow.

I moved the UI into the repository and connected it to the existing agent through Express and SSE. The override changed the implementation approach without adding accounts, payment, or other product scope.

The original decision and its rationale gave me a record to revise. I could state why the new approach fit the deliverable.

Design criterion: a changed decision names the changed assumption and preserves the constraints that still apply.

### 3. Verify the boundary separately from the presentation

I kept the core permission and simulated booking tests unchanged while adding the browser. I also inspected the new server for direct Duffel imports and real-order calls.

These checks supported a specific claim: the implemented booking path remained simulated. They did not replace browser review or establish production readiness.

I still checked much of the generated UI by hand. My next experiment was to define smaller tasks with explicit checks and calibrate a separate model reviewer.

Design criterion: a passing core test suite does not stand in for verification of a new interface.

## Pairing plan

| Feed | Article | Focus |
|---|---|---|
| A | A | Human-answer interface and browser transport |
| B | C | Recorded decisions and scope discipline |
| C | B | Permission, exceptions, and user review |

Place discussion questions in the first comment. Replace article-link and media placeholders before publishing.
