# LinkedIn — Post 2 of 3 · Publish Wednesday, July 29, 2026

**Angle:** Judgment / spec discipline.
**Audience:** design hiring managers, recruiters, hiring panel (EMs + PMs). Article skews to the EM/PM/design-manager assessing how you work.
**Series:** Mon (craft) → Wed (spec discipline) → Fri (trust). This is post 2.
**Contents:** feed post + long-form article.
**Status:** Ready to publish — does not depend on the demo video (see checklist).

---

## ✅ Before you publish Wednesday

- [ ] Publish the **article** first, then the **post** with the article link dropped into `[link to article]`.
- [ ] Add the `[IMAGE]` — the strongest visual is the actual decision record: the spec's locked-decisions section with the "OVERRIDDEN 2026-07-20" annotation, or the git diff of that override.
- [ ] Tense check: this post + article are about decisions already made and how you work — safe to publish without the demo video. Good mid-week anchor if the clips slip.

---
---

# FEED POST

Three weeks ago I locked a decision in my spec: *build the UI in a no-code builder.* This week I overrode it. Both were the right call — the judgment is in between.

I'm a product designer building an AI flight-booking agent in public. Phase 4 was the interface. My spec said use a no-code builder — fast, polished, doubles as a "designer who ships" signal.

Then I checked it against the *actual* goal. The deliverable isn't a hosted product. It's a 60-second demo of the agent deciding when to act vs. when to ask. For that, hosting on a builder bought me nothing — and it cost me the ability to wire the UI straight into the real agent loop (live flight search, live model, the real permission gate). So I killed my own locked decision and built it in-repo.

What let me override cleanly: the decision was *written down*, with its rationale, committed to git. Overriding a documented decision is deliberate and leaves a trail. Overriding a vibe is just drift.

Locking decisions early doesn't make you rigid. It's what lets you change your mind *on purpose*.

Full write-up — how I keep principled pivots from becoming scope drift 👇
[link to article]

→ How do you tell a principled pivot from scope drift on your teams?

#ProductManagement #ProductDesign #BuildingInPublic #AgenticAI

[IMAGE: the spec's locked-decisions section showing the "UI: build in v0/Lovable → OVERRIDDEN 2026-07-20" annotation (or the git diff of it). Caption: "The decision, and its override — both on the record."]

---
---

# LONG-FORM ARTICLE

## What building (not prototyping) an agent taught me about shipping something you can trust

[IMAGE: a snippet of the build log / decision record in git. Caption: "Decisions, with rationale, committed alongside the code."]

I'm a product designer who spent years arguing for design decisions in review. Building an AI agent in public has been a crash course in a different muscle: making decisions that have to survive contact with a running system. Four things from this week's phase — adding a browser UI to the agent — that I'd bring to a team.

**1. The spec is the highest-leverage design artifact.** Before any code, I wrote a technical design doc for this phase — topology, the exact API between browser and agent, the event types, the guardrails. It reads like process overhead. It isn't: it's the context that let me (and the agent) build the right thing instead of a plausible thing. When the doc was sharp, the output was sharp.

**2. Lock decisions early — so you can override them *on purpose*.** My spec locked "build the UI in a no-code builder." This week I overrode it: for a demo *video*, hosting bought nothing and blocked me from wiring the UI to the real agent, so I built in-repo. I could do that cleanly precisely because the original decision was written down with its rationale. Overriding a documented decision is deliberate; overriding a vibe is drift. Good teams make the first kind legible.

**3. Draw a hard line around what must stay correct — and defend it mechanically.** A handful of core files were read-only for this phase: the permission gate, the ranking logic, the mock booking, and their tests. The non-negotiable guardrail is that the agent can *never* reach a real, paid booking call. So after wiring the new server, I re-ran the check literally: grep the new code for any real-order call or booking-API import — must be none — and confirm the one external call in the whole system is still *search only*. "Trust me, it's mocked" isn't a guarantee. A test that fails the build if someone wires in a real order is.

**4. A clean contract keeps the layers honest.** The browser and the agent talk through a small, fixed set of events — *searching → ranking → deciding*, then offers, then a decision, then a confirmation. Each event maps to something the agent already produced; the UI *renders*, it never *re-derives*. That one rule — presentation shows state, it doesn't recompute it — is what stops product logic from quietly leaking into the front-end where it can't be tested.

The honest edge I'm still working on (because "look how fast I shipped" posts skip it): I can *generate* code far faster than I can *verify* it. The core trust logic is tested to the point of paranoia. The generated UI, I still check by hand. Naming that asymmetry — fast to produce, slow to trust — is the actual work of the next phase.

If you lead engineering, product, or design and you've shipped agentic features: I'd genuinely like to compare notes on where you draw the "must stay correct" line, and how you keep it from eroding.

*Week 2 of building in public.*
