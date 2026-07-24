# LinkedIn — Week 2 · Publish Monday, July 27, 2026

**Pairing:** Post C (feed) → Article B (long-form). Trust-boundary throughline.
**Audience:** design hiring managers, recruiters, hiring panel (EMs + PMs).
**Status:** Ready to publish once the demo video is dropped in (see checklist).

---

## ✅ Before you publish Monday

- [ ] Record the two `[VIDEO]` clips (both modes) — in progress this week.
- [ ] Drop the feed clip into the post; the escalation clip into the article.
- [ ] Add the `[IMAGE]` (three result cards: green / amber / red) to the article.
- [ ] Publish the **article** first, then the **post** with the article link in place of `[link to article]`.
- [ ] Sanity-check tense: everything reads as "built," so the video must show it actually running. If a clip isn't ready, switch the opening line to present tense ("here's how I'm building it") rather than claiming it's done.

---
---

# FEED POST

I've spent 15 years designing the "are you sure?" moment in fintech. This week I stopped drawing it and enforced it in code.

I'm a product designer building an AI flight-booking agent in public. It runs two ways: **automated** (book the best option that fits every rule) and **human-in-the-loop** (present options, you decide). The whole product is one question — *when should the agent act on its own, and when should it stop and ask?*

Here's the decision I'm proud of. Building the browser UI this week, the tempting move was to put that act-vs-ask logic in the screen. I refused.

The boundary lives in a permission gate in the core — code that runs *before* any booking and returns allow or pause. The UI only *renders* that decision: a green "meets all your rules," an amber "slightly over budget — book anyway?", a receipt stamped *simulated*. The screen shows the boundary; it never owns it.

The proof it held: there's a test suite guaranteeing the agent can't reach a real booking — and the entire UI was built without touching one of those tests. If the UI had *needed* to, that would've been my alarm that the boundary had moved.

Designing for oversight isn't a screen. It's *where you put the decision.*

Full write-up, including the mechanism underneath 👇
[link to article]

→ In your agent work, does the "ask the human" rule live in the prompt, the UI, or the core?

#AgenticAI #ProductDesign #HumanInTheLoop #DesignLeadership

[VIDEO: 20–30s — browser: natural-language request → live search → automated mode auto-books an eligible option with no prompt → switch to HITL → the same pick now pauses for approval. Caption: "Same agent, two oversight modes — watch where it acts vs. stops."]

---
---

# LONG-FORM ARTICLE

## I designed an agent's auto-vs-ask boundary. Then I made it impossible to bypass.

[IMAGE: three result cards — one green "eligible," one amber "tolerance / over budget," one greyed red "rejected." Caption: "Color is load-bearing here: it *is* the constraint status."]

For 15 years I've designed the moments where software hands control back to a person — exception queues, approval steps, the "are you sure?" Building my own AI agent let me stop specifying that boundary and actually enforce it. Here's the product thinking, with the mechanism underneath it.

The agent takes a trip and your rules — budget, max stops, total travel time, preferred airline — runs a real flight search, and runs in two modes: **automated** (book the best option that meets every rule; escalate if the best one breaks a rule) and **human-in-the-loop** (always present a preferred pick plus backups; you choose). Booking is mocked; the point was never a booking company. The point is the boundary.

### Trust isn't binary, so the gate isn't either

Every option lands in one of three tiers, decided by deterministic code, not the model:

- **Eligible** — in budget, every hard rule met. Auto-bookable.
- **Tolerance** — over budget by ≤20% *with every other hard rule met*. Never auto-booked; it's the escalation candidate — the "close, but this one's your call" case.
- **Rejected** — a hard rule broken (or >20% over). Not bookable, in either mode.

That middle tier is the whole design. Binary pass/fail has no room for "I found something 8% over that's otherwise perfect — want it?" The tolerance band *is* the trust conversation.

### Show the boundary before it's crossed, not after

The hero of the UI is a banner that states the agent's intent up front — automated: *"I'll auto-book the best option that meets all your rules; if nothing qualifies, I'll stop and ask."* HITL: *"I'll find and rank options — you make every booking call."* Oversight you only learn about *after* the agent acts isn't oversight. The boundary has to be legible in advance.

### Render the decision; don't reinvent it

Every booking decision produces a small structured record — mode, tier, outcome (allow / deny), and a plain-language `reason`. The UI shows that `reason` *verbatim* — "over your budget, so I won't book it automatically" — mapped to a color that carries meaning, not decoration: green = meets all rules, amber = escalation-worthy, red = breaks a rule. On a deliberately white, quiet UI, those are the only things that pop. The contrast *is* the legibility.

### The part I care about most: policy lives in code, not the prompt

I first tried to enforce "don't book without asking" with instructions to the model. Wrong — a prompt is a suggestion it can talk itself out of. The rule now lives in a permission gate that runs *before* any booking. When I built the UI, I kept that gate and its test suite read-only: the entire interface was assembled without editing the code that decides. If it had *needed* to, that would've meant the boundary had leaked into the presentation layer — exactly the failure I was guarding against.

And one more piece of discipline that made the whole thing connect cleanly: the browser and the agent talk through a small, fixed set of events — *searching → ranking → deciding*, then the ranked options, then the decision, then a confirmation. Each event maps to something the agent already produced. The UI *renders* state; it never *recomputes* it. That one rule is what stops product logic from quietly migrating into the front-end where it can't be tested.

The thesis I'm building toward: **automation isn't all-or-nothing; it's a boundary you move outward as trust accrues** — and where you *put* that boundary (core, not prompt, not UI) is what makes it real.

[VIDEO: automated mode hits an over-budget "tolerance" option → the agent pauses and asks instead of booking → approve → simulated confirmation. Caption: "The escalation moment — the boundary, visible and enforced."]

*Week 2 of building in public — a designer learning to build the systems he used to spec.*
