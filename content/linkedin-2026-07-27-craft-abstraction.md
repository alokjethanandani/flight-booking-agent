# LinkedIn draft 1: Connecting browser approval

Original planned publication date: July 27, 2026. Status: Draft. Publication is not confirmed here.

Audience: design hiring managers, recruiters, product managers, and engineering managers.

## Publication checklist

- [ ] Verify each claim against the current implementation.
- [ ] Add the planned image or recording. Keep simulated booking clearly labeled.
- [ ] Publish the article and replace `[link to article]` in the feed post.
- [ ] Add the discussion question as the first comment.

## Feed post

I connected a browser to my flight-booking agent through the same interface I had used for terminal approval.

The agent searches live fares and checks them against the user's constraints. Automated mode can simulate booking for an eligible offer. Manual review requires approval for every bookable offer.

In Phase 3, I separated human input from booking permission. One interface asked a question and waited for an answer. Keyboard input and scripted replies already used it.

For the browser, I added another implementation. It sent the question to the screen, waited for the user's answer, and resumed the existing gate.

That kept permission policy in one place. I could add a new input surface without rewriting the rule that decides whether booking can proceed.

Search uses live data. Every booking is simulated.

[link to article]

#ProductDesign #AgenticAI #BuildingInPublic #DesignEngineering

## First comment

Which input abstraction helped you add a new surface without changing policy?

## Article

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
