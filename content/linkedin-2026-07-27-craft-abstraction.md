# LinkedIn — Post 1 of 3 · Publish Monday, July 27, 2026

**Angle:** Craft / abstraction judgment.
**Audience:** design hiring managers, recruiters, hiring panel (EMs + PMs). Article skews to the EM/PM/design-manager who wants the mechanism.
**Series:** Mon (craft) → Wed (spec discipline) → Fri (trust). This is post 1.
**Contents:** feed post + long-form article.
**Status:** Ready to publish once the visual is dropped in (see checklist).

---

## ✅ Before you publish Monday

- [ ] Publish the **article** first, then the **post** with the article link dropped into `[link to article]`.
- [ ] Add the post `[VIDEO/IMAGE]` (agent pausing mid-run for input, or a diagram of the one interface with three plugs: keyboard / script / browser).
- [ ] Add the article `[VIDEO]` (both modes) + the two-mode toggle `[IMAGE]`.
- [ ] Tense check: reads as "built," so the visual must show it running. If no clip is ready, soften the opener to "here's how I'm wiring it up."

---
---

# FEED POST

This week I connected a browser to my AI agent. The part I'm proudest of: doing it added almost no new logic.

I'm a product designer building a flight-booking agent in public. It decides whether to book on its own or stop and ask you first. This week it needed a real UI.

Two weeks ago — before I needed it — I'd hidden every "ask the human" moment behind one tiny interface: one method that asks a question and waits for an answer. I'd written two versions of it: a keyboard (for live runs) and a script (for clean recordings).

Adding a browser was just a *third* version of that same interface. The agent pauses mid-decision, pushes the question to the screen over a live event stream, and waits — the exact same way it waits for a keypress. The hard part ("drive a *paused* agent from a web page") was already solved by a seam I built before I had a reason to.

No new decision logic. No touching the code that keeps the agent safe. A third plug into an existing socket.

The senior move in agentic work isn't generating more code. It's building the seam that makes the next feature nearly free.

Full write-up — the mechanism underneath 👇
[link to article]

→ What's an abstraction you built early that quietly paid you back later?

#ProductDesign #AgenticAI #BuildingInPublic #DesignEngineering

[VIDEO / IMAGE: agent pauses mid-run and waits for approval in the browser — OR a simple diagram: one "ask()" interface with three plugs (keyboard · script · browser). Caption: "One interface, three inputs. The browser was just the third plug."]

---
---

# LONG-FORM ARTICLE

## How I drove a paused AI agent from a browser without touching the code that keeps it safe

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
