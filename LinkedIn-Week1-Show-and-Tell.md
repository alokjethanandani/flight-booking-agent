# Week 1: building FlightGenie

Status: Publishing draft. This records the first build's lessons, not the current tooling baseline. Replace media and article-link placeholders before publishing.

## Feed post

I built a flight-booking agent to test a decision I work on in B2B FinTech: when software can act and when a person should decide.

FlightGenie searches live fares and checks the user's budget, stops, and duration. Automated mode can simulate booking for eligible offers. Manual review requires approval for every bookable offer.

Three decisions shaped the build:

- I wrote the product brief before the interface so the agent had explicit scope, constraints, and acceptance criteria.
- I enforced booking permission in code before the booking tool could execute.
- I kept a build log with decisions, failures, and verification notes so later sessions could recover the context.

The tests covered the core permission rules and simulated booking. I still reviewed much of the generated UI by hand. That gap became the next experiment: smaller tasks, explicit checks, and a separate reviewer.

Search is live. Every booking is simulated.

[link to article]

#AgenticAI #ProductDesign #HumanInTheLoop #BuildingInPublic

## First comment

What would you need to inspect before granting an agent permission to spend money?

## Article

### What building a flight agent taught me about oversight

I built FlightGenie to make booking permission testable. The model could interpret a trip and recommend a flight, while a separate code gate decided whether the booking tool could execute.

The agent used live Duffel offers. Every booking was simulated, with no card charge or ticket. That let me test the approval interaction without making a real purchase.

[IMAGE: the mode control. Caption: "One agent with two booking permission modes."]

### 1. Write the constraints before generating the interface

I used Claude to draft a [product brief](Mini-PRD-Flight-Booking-Agent.md) covering scope, success criteria, non-goals, and a phased plan.

The brief gave later sessions a concrete reference. It specified live search, simulated booking, and two modes. It also excluded accounts, real payment, and unrelated travel services.

I could compare a generated feature with that scope before accepting it. A plausible interface alone would not establish that it met the goal.

Design criterion: each feature can be traced to a stated requirement or a recorded scope change.

[IMAGE: product brief scope and non-goals.]

### 2. Choose components against the actual interactions

I needed result cards, settings controls, approval states, and a visible plan. I used shadcn/ui as the component base and defined the product-specific flight and oversight surfaces around it.

The current browser build uses Base UI primitives, React, and Tailwind. The library choice supplied controls. I still had to define the behavior that connected them to the agent.

Design criterion: component selection supports the required interaction states without deciding the product behavior for me.

[IMAGE: the design system and flight result components.]

### 3. Put booking permission before execution

Manual review required approval for every bookable offer. Automated mode could proceed with an eligible offer and needed approval for an offer within the budget tolerance. Rejected offers stayed blocked.

The gate classified offers against configured budget, stops, duration, and currency checks. The default tolerance allowed an approval request up to 20% over budget when the other hard constraints passed.

I kept model interpretation separate from those checks. Dates and time windows in the request still depended on model interpretation. They were not all enforced by the deterministic gate.

The confirmation disclosed that the booking was simulated. That label mattered because a complete-looking receipt could otherwise imply a real transaction.

Design criterion: a model recommendation cannot bypass the permission rule, and the receipt accurately describes the action.

[VIDEO: compare automated and manual-review runs. Keep the simulation label visible.]

### 4. Keep the decision history with the code

I recorded decisions, bugs, and unresolved questions in the [build log](BUILD-LOG.md). Each session could read the history before continuing.

That made the rationale available alongside the implementation. When a decision changed, I could record the changed assumption rather than reconstructing it from conversation history.

Design criterion: a later session can identify both the current decision and why it changed.

[IMAGE: a build-log entry showing a decision and its verification.]

### 5. Measure verification separately from generation

The existing tests checked core classification, permission routing, offer expiry, and simulated booking. A source scan checked the booking module for Duffel imports and real-order patterns.

Those checks supported specific implementation claims. They did not validate the generated UI or establish that travelers wanted the product. I still reviewed much of the interface manually.

My [learning roadmap](Learning-Roadmap-Loop-Engineering.md) proposed smaller tasks, explicit checks, and a separate model reviewer. I also needed user feedback to test the product premise.

Design criterion: completion requires evidence for implementation quality and a separate test of whether the product solves a user need.

[IMAGE: planned build and verification loop.]
