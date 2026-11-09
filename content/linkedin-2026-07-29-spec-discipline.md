# LinkedIn draft 2: Revising a recorded decision

Original planned publication date: July 29, 2026. Status: Draft. Publication is not confirmed here.

Audience: design hiring managers, recruiters, product managers, and engineering managers.

## Publication checklist

- [ ] Verify each claim against the current implementation.
- [ ] Add the planned image or recording. Keep simulated booking clearly labeled.
- [ ] Publish the article and replace `[link to article]` in the feed post.
- [ ] Add the discussion question as the first comment.

## Feed post

I changed a recorded technical decision after checking it against the deliverable.

My original spec put FlightGenie's interface in v0/Lovable. The deliverable was a screen-recorded demo of a live agent, so I reconsidered that choice.

I built the UI in the repository with React and an Express bridge. That let the browser connect directly to the existing search, classification, and approval flow.

I recorded the override with its rationale. The product scope stayed the same: live flight search, two approval modes, and simulated booking.

The written decision gave me something specific to revise. I could explain which assumption had changed and which constraints still held.

[link to article]

#ProductManagement #ProductDesign #BuildingInPublic #AgenticAI

## First comment

What evidence would justify changing a recorded technical decision on your team?

## Article

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
