# Mini-PRD — Consumer Flight-Booking Agent

**Learning-roadmap artifact #1** (replaces the iOS anti-snooze alarm POC) · **Owner:** Alok · **Drafted:** July 5, 2026 · **Status:** Draft — for sign-off before building

> Parent strategy: `Strategy-PRD-Personal-Brand-and-Job-Search.md` §7C. This brief covers one artifact.

---

## 0. TL;DR

Build a working consumer flight-booking agent that comparison-shops against a user's constraints (budget, max stops, total duration, preferred airlines) and runs in two modes: **fully-automated** (find + book the best option that meets all constraints) and **human-in-the-loop** (present a preferred + secondary set for the user to book manually). Flight **search is real** (Duffel); **booking is mocked** — the agent never charges a card or issues a real ticket. Built on the **Claude Agent SDK** so you actually learn the agent loop, tool use, and HITL checkpoints.

The automation-vs-oversight toggle is the whole point: it's a live demonstration of *when an agent should act vs. ask* — your signature design problem, now something you've built, not just shipped at BILL.

## 1. Why this artifact (dual purpose)

- **Learning:** move from "I prototype apps" to "I build agents" — the 2026 AI-native hiring bar. You'll implement a real tool-use loop and a human-in-the-loop checkpoint, not a scripted flow.
- **Positioning:** the mode toggle *is* your POV made tangible — trust calibration, control surfaces, intervention points ("designing for human oversight, not execution," parent §3 pillar 2). One artifact that pays three ways: portfolio case study, live interview demo, content.
- **Why flights:** a constraint-heavy decision problem with legible agent reasoning ("preferred vs. secondary, and why"), and a relatable demo anyone in a loop will understand.

## 2. Success criteria

- **Learning (the real bar):** you can explain and implement an agent loop — tool definitions → model picks a tool → execute → feed result back → repeat → stop — plus a checkpoint that pauses before a consequential action. A running agent exists.
- **Artifact:** a screen-recordable demo where a natural-language request → agent searches real flights → ranks against constraints → **either** auto-books the best in-budget option **or** presents preferred + secondary for the user to pick, with the reasoning visible.
- **Content/interview:** a digest ("what building an agent taught me about designing for human oversight") + a live-demo story for loops + 2–3 LinkedIn posts.
- **Definition of done:** demoable end-to-end in *both* modes, with the oversight model legible in the UI. Not production-hardened.

## 3. Scope

**In scope (v1):**
- Natural-language intake of a trip request + constraints: origin, destination, dates, budget, max stops, max total duration, preferred airline(s), passenger count, cabin class. One-way and round-trip only.
- Real flight search via Duffel → normalized offers.
- Constraint filtering + ranking into a **preferred** pick and **secondary** options.
- Two modes: **automated** (auto-select + mock-book if the best option meets all constraints; otherwise escalate to the user) and **HITL** (always present options, user picks, mock-book).
- A settings surface for mode + constraints.
- A thin UI (chat + result cards + settings) — enough to demo.
- A **mock** booking confirmation (a fake PNR-style record).

**Non-goals (v1):**
- Real payment, real ticketing, real PNRs — never.
- Hotels, cars, multi-city itineraries, loyalty/points, seat selection.
- Accounts, production auth, scale, exhaustive error handling.
- The B2B "policy mode" version — out of scope (not built, not tracked).

## 4. Constraints & guardrails

- **No financial or irreversible actions.** Booking is simulated: the agent stops before Duffel's paid `order` step. A live Duffel token is used for **search only** (search is effectively free; booking is where money happens, and we don't call it). `book_flight` returns a fake confirmation.
- **Scope discipline.** This is the parent PRD's #1 risk (perpetual prep). v1 is a demo, not a product; resist adding hotels/cars/multi-city.
- **No BILL IP** — wholly independent domain.
- **Time budget:** fits your Mon/Tue "Learn & Build" blocks; target ~2–3 weeks part-time.

## 5. Architecture

**Runtime — Claude Agent SDK, TypeScript** (`npm install @anthropic-ai/claude-agent-sdk`, Node 18+; a Python build exists but see §10 for why TS wins here). It gives you the tool-use loop and **optional human-in-the-loop checkpoints** out of the box — which map exactly onto our two modes. Flight search uses Duffel's official TS client, `@duffel/api`.

**Tools the agent is given:**

| Tool | Does | Notes |
|---|---|---|
| `search_flights(params)` | Calls Duffel offer search; returns normalized offers | Real data. `params` includes passenger count and cabin class (user-configurable, added 2026-07-07 — not fixed defaults) |
| `rank_offers(offers, constraints)` | Filters + scores by budget/stops/duration/airline; returns preferred + secondaries | Code or agent-reasoned |
| `ask_user(question)` | The HITL escalation / choice surface | Used in HITL mode + auto-mode escalations |
| `book_flight(offer_id)` | **Mock** — returns a fake confirmation | Never hits Duffel's paid `order` endpoint |

**Mode routing:** the setting decides whether the loop may call `book_flight` autonomously (automated, when constraints are met) or must hit a checkpoint / `ask_user` first (HITL, and auto-mode when the best option breaks a constraint).

**UI:** thin front-end (chat + result cards + settings) reading the agent's messages, built in **v0/Lovable** — which doubles as a "designer who builds" artifact.

## 6. Learn-then-build ramp

A short ramp so you're not building blind — each step is a tiny commit and itself a content beat:

1. **Agent loop fundamentals** — read the Agent SDK overview; run the quickstart; understand tool-def → call → result → loop → stop.
2. **One tool** — define a single dummy tool, watch the loop invoke it.
3. **HITL checkpoint** — add a pause before a "consequential" tool.
4. **Then the real tools** — Duffel search, ranking, mock booking.

## 7. Phased build plan

- **Phase 0 — Setup (½ day):** Duffel account + token; SDK installed; hello-world agent with one dummy tool.
- **Phase 1 — Real search (2–3 sessions):** `search_flights` against Duffel; normalize offers; print ranked results in the terminal (no UI).
- **Phase 2 — Constraints + ranking (1–2 sessions):** budget/stops/duration/airline filters; preferred vs. secondary logic.
- **Phase 3 — Two modes (2 sessions):** automated (auto-pick + mock-book if in-constraint, else escalate) and HITL (present + wait). **This is the design centerpiece — make the oversight legible.**
- **Phase 4 — Thin UI + settings in v0/Lovable (2–3 sessions):** chat + result cards + mode/constraint settings.
- **Phase 5 — Demo + content (1–2 sessions):** screen-record both modes; write the digest; cut LinkedIn posts.

Each phase ends in something demoable. Stop when it's a clean demo — not when it's "done."

## 8. The design story to capture (interview gold)

- **When does the agent act vs. ask?** Show how mode + constraints define the trust boundary.
- **Control surfaces:** how the user sets guardrails (budget, airlines) so automation is safe by construction — ties to your "policy-driven / correct by construction" theme.
- **Transparency:** how the agent shows *why* this preferred vs. secondary, so a human can trust or override.
- **The escalation moment:** what a good "I paused because this breaks your rule X" looks like.

## 9. Risks

| Risk | Mitigation |
|---|---|
| Scope creep (hotels, cars, multi-city) | Timebox; v1 only; non-goals are explicit |
| Duffel *test mode* returns one sandbox airline (unrealistic comparison) | Use **production search** for real multi-airline data; mock **only** the booking step |
| Over-built UI steals focus | Keep it thin — the agent + oversight model is the star |
| SDK learning curve | The §6 ramp de-risks it before the real build |

## 10. Decisions (locked)

1. **Language:** TypeScript, end-to-end (agent + UI). Duffel's TS client is maintained; the Python one isn't.
2. **Data:** live Duffel token — real multi-airline search; **booking mocked** (never call the paid `order` step).
3. **UI:** build in **v0/Lovable** (fast; doubles as a "designer who builds" artifact).
4. **Trip types:** one-way + round-trip only; multi-city out of scope.
5. **B2B "policy mode":** out of scope — not built, not tracked.

All resolved — ready to start Phase 0 (setup). Phase 0 needs credentials that are yours to create: a **Duffel account + API token** and an **Anthropic API key** for the agent.
