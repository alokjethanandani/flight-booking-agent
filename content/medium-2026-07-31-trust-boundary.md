# Medium — adapted from Post 3 of 3 (Fri, July 31, 2026)

**Source:** `linkedin-2026-07-31-trust-boundary.md` (long-form article half).
**Platform notes:** subtitle added; pull quotes added; hashtags removed (use Medium's tag picker at publish, suggestions below); section headers bumped to `##`.
**Status:** Ready to publish once the `[IMAGE]`/`[VIDEO]` assets are dropped in.
**Suggested Medium tags (pick 5):** Artificial Intelligence, Product Design, UX, AI Agents, Design Leadership

---

# I Designed an AI Agent's Auto-vs-Ask Boundary. Then I Made It Impossible to Bypass.

### Fifteen years of designing "are you sure?" moments taught me trust isn't a screen — it's a decision about where control lives in the code.

[IMAGE: three result cards — one green "eligible," one amber "tolerance / over budget," one greyed red "rejected." Caption: *Color is load-bearing here: it is the constraint status.*]

For 15 years I've designed the moments where software hands control back to a person — exception queues, approval steps, the "are you sure?" Building my own AI agent let me stop specifying that boundary and actually enforce it. Here's the product thinking, with the mechanism underneath it.

The agent takes a trip and your rules — budget, max stops, total travel time, preferred airline — runs a real flight search, and runs in two modes: **automated** (book the best option that meets every rule; escalate if the best one breaks a rule) and **human-in-the-loop** (always present a preferred pick plus backups; you choose). Booking is mocked; the point was never a booking company. The point is the boundary.

## Trust isn't binary, so the gate isn't either

Every option lands in one of three tiers, decided by deterministic code, not the model:

- **Eligible** — in budget, every hard rule met. Auto-bookable.
- **Tolerance** — over budget by ≤20% *with every other hard rule met*. Never auto-booked; it's the escalation candidate — the "close, but this one's your call" case.
- **Rejected** — a hard rule broken (or >20% over). Not bookable, in either mode.

> Binary pass/fail has no room for "I found something 8% over that's otherwise perfect — want it?" The tolerance band *is* the trust conversation.

## Show the boundary before it's crossed, not after

The hero of the UI is a banner that states the agent's intent up front — automated: *"I'll auto-book the best option that meets all your rules; if nothing qualifies, I'll stop and ask."* HITL: *"I'll find and rank options — you make every booking call."* Oversight you only learn about *after* the agent acts isn't oversight. The boundary has to be legible in advance.

## Render the decision; don't reinvent it

Every booking decision produces a small structured record — mode, tier, outcome (allow/deny), and a plain-language `reason`. The UI shows that `reason` *verbatim* — "over your budget, so I won't book it automatically" — mapped to a color that carries meaning, not decoration: green means every rule is met, amber means it's escalation-worthy, red means it breaks a rule. On a deliberately white, quiet UI, those are the only things that pop. The contrast *is* the legibility.

## The part I care about most: policy lives in code, not the prompt

I first tried to enforce "don't book without asking" with instructions to the model. Wrong — a prompt is a suggestion it can talk itself out of. The rule now lives in a permission gate that runs *before* any booking. When I built the UI, I kept that gate and its test suite read-only: the entire interface was assembled without editing the code that decides. If it had *needed* to, that would've meant the boundary had leaked into the presentation layer — exactly the failure I was guarding against.

And one more piece of discipline that made the whole thing connect cleanly: the browser and the agent talk through a small, fixed set of events — *searching → ranking → deciding*, then the ranked options, then the decision, then a confirmation. Each event maps to something the agent already produced. The UI *renders* state; it never *recomputes* it. That one rule is what stops product logic from quietly migrating into the front-end where it can't be tested.

> Automation isn't all-or-nothing; it's a boundary you move outward as trust accrues — and where you put that boundary (core, not prompt, not UI) is what makes it real.

[VIDEO: automated mode hits an over-budget "tolerance" option → the agent pauses and asks instead of booking → approve → simulated confirmation. Caption: *The escalation moment — the boundary, visible and enforced.*]

---

*Week 2 of building in public — a designer learning to build the systems he used to spec.*

I'd love to hear from others building agents: in your systems, does the "ask the human" rule live in the prompt, the UI, or the core?

---

### About the Author

I'm **Alok**, a Lead Product Designer with 15+ years in B2B FinTech, currently focused on agentic AI workflows, AP/AR automation, and product design for complex financial workflows — exception handling, trust calibration, and back-office automation. This flight-booking agent is a side project I'm building in public to learn the systems I've spent my career specifying.

[Connect on LinkedIn](#) · [More from this series](#)
