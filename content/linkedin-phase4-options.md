# Phase 4 — LinkedIn content options (technical decisions, with examples)

Six drafts: **3 short feed posts** + **3 long-form articles**, each built on concrete details from `HLD-Phase4-Web-UI.md`. Voice matched to the Week-1 building-in-public post.

**Audience (both formats):** design hiring managers, recruiters, and a hiring panel (EMs + PMs). Posts stay accessible while signaling judgment. Articles skew to the EM / PM / design-manager who wants the mechanism, not just the moral.

Pick one post + one article, or mix. `[VIDEO]` / `[IMAGE]` marks where to drop a screen recording.

---
---

# PART 1 — SHORT FEED POSTS (pick one)

## Post A — "The best code I didn't write" (craft / abstraction judgment)

This week I connected a browser to my AI agent. The part I'm proudest of: doing it added almost no new logic.

I'm a product designer building a flight-booking agent in public. It decides whether to book on its own or stop and ask you first. This week it needed a real UI.

Two weeks ago — before I needed it — I'd hidden every "ask the human" moment behind one tiny interface: one method that asks a question and waits for an answer. I'd written two versions of it: a keyboard (for live runs) and a script (for clean recordings).

Adding a browser was just a *third* version of that same interface. The agent pauses mid-decision, pushes the question to the screen over a live event stream, and waits — the exact same way it waits for a keypress. The hard part ("drive a *paused* agent from a web page") was already solved by a seam I built before I had a reason to.

No new decision logic. No touching the code that keeps the agent safe. A third plug into an existing socket.

The senior move in agentic work isn't generating more code. It's building the seam that makes the next feature nearly free.

→ What's an abstraction you built early that quietly paid you back later?

#ProductDesign #AgenticAI #BuildingInPublic #DesignEngineering

---

## Post B — "I overrode my own locked decision" (judgment / spec discipline)

Three weeks ago I locked a decision in my spec: *build the UI in a no-code builder.* This week I overrode it. Both were the right call — the judgment is in between.

I'm a product designer building an AI flight-booking agent in public. Phase 4 was the interface. My spec said use a no-code builder — fast, polished, doubles as a "designer who ships" signal.

Then I checked it against the *actual* goal. The deliverable isn't a hosted product. It's a 60-second demo of the agent deciding when to act vs. when to ask. For that, hosting on a builder bought me nothing — and it cost me the ability to wire the UI straight into the real agent loop (live flight search, live model, the real permission gate). So I killed my own locked decision and built it in-repo.

What let me override cleanly: the decision was *written down*, with its rationale, committed to git. Overriding a documented decision is deliberate and leaves a trail. Overriding a vibe is just drift.

Locking decisions early doesn't make you rigid. It's what lets you change your mind *on purpose*.

→ How do you tell a principled pivot from scope drift on your teams?

#ProductManagement #ProductDesign #BuildingInPublic #AgenticAI

---

## Post C — "Where does 'are you sure?' live?" (trust boundary in code — the design POV)

I've spent 15 years designing the "are you sure?" moment in fintech. This week I stopped drawing it and enforced it in code.

I'm a product designer building an AI flight-booking agent in public. It runs two ways: **automated** (book the best option that fits every rule) and **human-in-the-loop** (present options, you decide). The whole product is one question — *when should the agent act on its own, and when should it stop and ask?*

Here's the decision I'm proud of. Building the browser UI this week, the tempting move was to put that act-vs-ask logic in the screen. I refused.

The boundary lives in a permission gate in the core — code that runs *before* any booking and returns allow or pause. The UI only *renders* the decision: a green "meets all your rules," an amber "slightly over budget — book anyway?", a receipt stamped *simulated*. The screen shows the boundary; it never owns it.

The proof it held: there's a test suite guaranteeing the agent can't reach a real booking — and the entire UI was built without touching one of those tests. If the UI had *needed* to, that would've been my alarm that the boundary had moved.

Designing for oversight isn't a screen. It's *where you put the decision.*

→ In your agent work, does the "ask the human" rule live in the prompt, the UI, or the core?

#AgenticAI #ProductDesign #HumanInTheLoop #DesignLeadership

---
---

# PART 2 — LONG-FORM ARTICLES (pick one)

## Article A — "How I drove a paused AI agent from a browser without touching the code that keeps it safe"

*Skew: architecture judgment for EMs. The abstraction-payoff story, with the mechanism shown.*

[IMAGE: the two-mode toggle + an amber escalation callout from the prototype. Caption: "The UI renders the decision. It never makes it."]

I'm a Lead Product Designer moving from *prototyping* products to *building* agents, in public. My project is a consumer flight-booking agent: give it a trip and your constraints, it runs a real multi-airline search, ranks the results, and either books the best qualifying option itself or stops and asks you — depending on the mode. Search is real; **booking is mocked**, always.

By this week the agent already worked end-to-end in a terminal. Phase 4's job was a browser UI. And browsers make one thing genuinely hard here: the agent *pauses mid-run* to ask a human for approval. How do you drive a paused, human-in-the-loop process from a web page — without moving the logic that makes it trustworthy?

**The seam was already there.** Back in Phase 3, I'd made one deliberate choice: the agent's permission gate never reads the keyboard directly. It calls a small interface — `ask(question) → answer` — and something else decides where that question goes. I'd shipped two implementations: real keyboard input for a live demo, and a scripted queue (`"y"`, `"n"`, `"3"`) so I could record reproducible takes. The browser became a *third* implementation of the exact same interface.

**The mechanism.** When the agent hits a booking decision it can't make alone, the gate calls `ask(...)`. The web implementation does two things: it emits the question to the browser over a one-way event stream (Server-Sent Events), and it returns a promise whose `resolve` it *parks* — the call just hangs there, pending. This works because the SDK's permission callback is async; it will happily await a browser round-trip for as long as it already awaits a keypress. When you click **Approve / Decline / pick option 3**, the browser POSTs that answer back, the server finds the parked `resolve`, and the gate wakes up and finishes — booking through the same mock, denying through the same logic.

The contract the browser speaks is the *same* one the keyboard spoke: `"y"` / `"n"` / a number. So the file that actually decides act-vs-ask needed **zero changes**. The UI transports the question and the answer; it holds no routing rules of its own.

**Why not WebSockets?** The traffic is asymmetric — a stream of events out, a couple of discrete POSTs back. SSE covers the stream with less ceremony, reconnects on its own, and is trivial to render. The heavier tool would've been chrome, not capability.

**The discipline that made it safe.** I put a short list of core files off-limits for the whole phase — the permission gate, the ranking logic, the mock booking, and their tests. The rule I wrote for myself: *if building the UI appears to require editing one of these, stop — that's the signal the trust boundary is about to move.* It never did. The UI is purely additive.

**The takeaway for anyone building agents:** the leverage isn't in generating more code faster. It's in finding the one seam — here, "abstract human input behind an interface" — that turns your next hard feature into a small, safe plug-in. I built that seam a week before I needed it, and this week it paid for itself.

[VIDEO: 30–60s — browser: natural-language request → live search → automated mode auto-books an eligible option with no prompt → switch to HITL → the same pick now pauses for approval. Caption: "Same agent, two oversight modes — watch where it acts vs. stops."]

*Week 2 of building in public. Next: closing the gap between how fast I can generate and how fast I can verify.*

---

## Article B — "I designed an agent's auto-vs-ask boundary. Then I made it impossible to bypass."

*Skew: product & design leadership for design managers / PMs. Trust calibration made concrete.*

[IMAGE: three result cards — one green "eligible," one amber "tolerance / over budget," one greyed red "rejected." Caption: "Color is load-bearing here: it *is* the constraint status."]

For 15 years I've designed the moments where software hands control back to a person — exception queues, approval steps, the "are you sure?" Building my own AI agent let me stop specifying that boundary and actually enforce it. Here's the product thinking, with the mechanism underneath it.

The agent takes a trip and your rules — budget, max stops, total travel time, preferred airline — runs a real flight search, and runs in two modes: **automated** (book the best option that meets every rule; escalate if the best one breaks a rule) and **human-in-the-loop** (always present a preferred pick plus backups; you choose). Booking is mocked; the point was never a booking company. The point is the boundary.

**Trust isn't binary, so the gate isn't either.** Every option lands in one of three tiers, decided by deterministic code, not the model:

- **Eligible** — in budget, every hard rule met. Auto-bookable.
- **Tolerance** — over budget by ≤20% *with every other hard rule met*. Never auto-booked; it's the escalation candidate — the "close, but this one's your call" case.
- **Rejected** — a hard rule broken (or >20% over). Not bookable, in either mode.

That middle tier is the whole design. Binary pass/fail has no room for "I found something 8% over that's otherwise perfect — want it?" The tolerance band *is* the trust conversation.

**Show the boundary before it's crossed, not after.** The hero of the UI is a banner that states the agent's intent up front — automated: *"I'll auto-book the best option that meets all your rules; if nothing qualifies, I'll stop and ask."* HITL: *"I'll find and rank options — you make every booking call."* Oversight you only learn about *after* the agent acts isn't oversight. The boundary has to be legible in advance.

**Render the decision; don't reinvent it.** Every booking decision produces a small structured record — mode, tier, outcome (allow / deny), and a plain-language `reason`. The UI shows that `reason` *verbatim* — "over your budget, so I won't book it automatically" — mapped to a color that carries meaning, not decoration: green = meets all rules, amber = escalation-worthy, red = breaks a rule. On a deliberately white, quiet UI, those are the only things that pop. The contrast *is* the legibility.

**And the part I care about most: policy lives in code, not the prompt.** I first tried to enforce "don't book without asking" with instructions to the model. Wrong — a prompt is a suggestion it can talk itself out of. The rule now lives in a permission gate that runs *before* any booking. When I built the UI, I kept that gate and its test suite read-only: the entire interface was assembled without editing the code that decides. If it had *needed* to, that would've meant the boundary had leaked into the presentation layer — exactly the failure I was guarding against.

The thesis I'm building toward: **automation isn't all-or-nothing; it's a boundary you move outward as trust accrues** — and where you *put* that boundary (core, not prompt, not UI) is what makes it real.

[VIDEO: automated mode hits an over-budget "tolerance" option → the agent pauses and asks instead of booking → approve → simulated confirmation. Caption: "The escalation moment — the boundary, visible and enforced."]

*Week 2 of building in public — a designer learning to build the systems he used to spec.*

---

## Article C — "What building (not prototyping) an agent taught me about shipping something you can trust"

*Skew: how-I-work, for a hiring panel (EM + PM + design manager) assessing judgment and rigor.*

[IMAGE: a snippet of the build log / decision record in git. Caption: "Decisions, with rationale, committed alongside the code."]

I'm a product designer who spent years arguing for design decisions in review. Building an AI agent in public has been a crash course in a different muscle: making decisions that have to survive contact with a running system. Four things from this week's phase — adding a browser UI to the agent — that I'd bring to a team.

**1. The spec is the highest-leverage design artifact.** Before any code, I wrote a technical design doc for this phase — topology, the exact API between browser and agent, the event types, the guardrails. It reads like process overhead. It isn't: it's the context that let me (and the agent) build the right thing instead of a plausible thing. When the doc was sharp, the output was sharp.

**2. Lock decisions early — so you can override them *on purpose*.** My spec locked "build the UI in a no-code builder." This week I overrode it: for a demo *video*, hosting bought nothing and blocked me from wiring the UI to the real agent, so I built in-repo. I could do that cleanly precisely because the original decision was written down with its rationale. Overriding a documented decision is deliberate; overriding a vibe is drift. Good teams make the first kind legible.

**3. Draw a hard line around what must stay correct — and defend it mechanically.** A handful of core files were read-only for this phase: the permission gate, the ranking logic, the mock booking, and their tests. The non-negotiable guardrail is that the agent can *never* reach a real, paid booking call. So after wiring the new server, I re-ran the check literally: grep the new code for any real-order call or booking-API import — must be none — and confirm the one external call in the whole system is still *search only*. "Trust me, it's mocked" isn't a guarantee. A test that fails the build if someone wires in a real order is.

**4. A clean contract keeps the layers honest.** The browser and the agent talk through a small, fixed set of events — *searching → ranking → deciding*, then offers, then a decision, then a confirmation. Each event maps to something the agent already produced; the UI *renders*, it never *re-derives*. That one rule — presentation shows state, it doesn't recompute it — is what stops product logic from quietly leaking into the front-end where it can't be tested.

The honest edge I'm still working on (because "look how fast I shipped" posts skip it): I can *generate* code far faster than I can *verify* it. The core trust logic is tested to the point of paranoia. The generated UI, I still check by hand. Naming that asymmetry — fast to produce, slow to trust — is the actual work of the next phase.

If you lead engineering, product, or design and you've shipped agentic features: I'd genuinely like to compare notes on where you draw the "must stay correct" line, and how you keep it from eroding.

*Week 2 of building in public.*

---
---

## Notes on the choices

- **Concrete examples added per point** (all from the HLD): the three `AnswerProvider` implementations (keyboard / script / browser); the parked-promise + SSE bridge; the `"y" / "n" / number` contract that let the core stay unchanged; the eligible / tolerance / rejected tiers and the ≤20% band; the structured decision record and its verbatim `reason`; green/amber/red as load-bearing color; the seven read-only files; the grep-for-real-order-calls verification.
- **Audience skew:** posts lead with a human hook and end on an engagement question (recruiter/HM-friendly) while still showing an engineering-legible decision (panel-friendly). Articles go one layer deeper into mechanism for the EM/PM/design-manager reader.
- **Pairing suggestion:** Post C + Article B (design-leadership throughline), or Post A + Article A (craft throughline), or Post B + Article C (judgment/process throughline).
