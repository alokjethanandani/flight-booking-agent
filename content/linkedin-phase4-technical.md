# Phase 4: giving the agent a UI — LinkedIn post (technical decisions)

Feed post (~230 words), in the Week-1 building-in-public voice. Drop in a screen recording before publishing. An alternate hook is at the bottom for A/B testing.

---

## Feed post

Last week I built my first AI agent. This week I gave it a UI — and the most interesting technical decision was one I *didn't* make.

I'm a product designer building a flight-booking agent in public. This week's job: put a browser front-end on it so you can *watch* it decide whether to book on its own or stop and ask you first. Three decisions from wiring it up:

→ **I overrode my own plan.** I'd locked "build the UI in v0/Lovable" weeks ago. I killed it. The deliverable is a demo video, not a hosted app — so hosting bought me nothing, and building in-repo was the faster path to something real and wired. Knowing when the "right" tool is the wrong one for *this* goal is its own skill.

→ **The trust boundary stays in code. The UI only renders it.** Every instinct with a front-end is to put the "when does it ask me?" logic into the screen. I refused. The permission gate that decides act-vs-ask already lives in the core — the browser just shows what it decided. The whole web layer is additive; it never touches the 29 tests that prove the agent can't reach a real booking.

→ **My best decision this week was made two weeks ago.** Back then I hid all human input behind one interface — keyboard for a live run, a script for recordings. Adding a browser was just a third option on that same seam. The hard part — driving a *paused* agent from a web page — was already solved by an abstraction I built before I needed it.

The lesson: the best code I wrote this week was the code I didn't write.

Builders — what's an abstraction you built early that quietly saved you later? 👇

#AgenticAI #ProductDesign #BuildingInPublic #HumanInTheLoop #SoftwareDesign

---

## Alternate hook (for A/B)

> I locked a technical decision three weeks ago. This week I overrode it — and it was the right call both times. Here's what building a UI for my AI agent taught me about when to break your own rules 👇
