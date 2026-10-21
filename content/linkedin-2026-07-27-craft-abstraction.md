# LinkedIn — Post 1 of 3 · Publish Monday, July 27, 2026

**Angle:** UX craft — removing the form (chat intake vs. Kayak/Google Flights-style filters), and what has to get smarter underneath to make that safe: deterministic budget parsing, a real follow-up question when info is missing, and a named escalation when nothing matches.
**Audience:** design hiring managers, recruiters, hiring panel (EMs + PMs). Article skews to the EM/PM/design-manager who wants the mechanism.
**Series:** Mon (craft) → Wed (spec discipline) → Fri (trust). This is post 1.
**Contents:** feed post + long-form article.
**Status:** Ready to publish once the visual is dropped in (see checklist).
**Revision note (2026-07-31):** Re-angled from the original browser/abstraction take (now folded into `linkedin-2026-07-31-trust-boundary.md`, Friday's post) to the chat-vs-form UX decision, at Alok's request. Flagging one thing before you publish: Friday's post also uses the tolerance-tier/escalation mechanism, from a different lens (*where the decision lives*, code vs. UI) vs. this post's lens (*why remove the form*, and what backs that up). The overlap is the same underlying feature seen twice — worth a skim of both back-to-back to make sure Monday doesn't spoil Friday's reveal. Easiest fix if it reads redundant: cut the escalation paragraph here down to one line and let Friday own the depth.

---

## ✅ Before you publish Monday

- [ ] Publish the **article** first, then the **post** with the article link dropped into `[link to article]`.
- [ ] Add the post `[VIDEO/IMAGE]` (side-by-side: a traditional flight-search form vs. this agent's single text box, or a screen recording of the one-line intake going straight to ranked results).
- [ ] Add the article `[IMAGE]` (the empty-state card naming the binding rule) + `[VIDEO]` (a missing-info follow-up question, asked and answered, mid-run).
- [ ] Tense check: reads as "built," so the visual must show it running. If no clip is ready, soften the opener to "here's how I'm wiring it up."
- [ ] Re-read against Friday's post (see revision note above) before scheduling both — trim the escalation beat here if it steps on Friday's reveal.

---
---

# FEED POST

Kayak's search form has around a dozen fields. Mine has one text box.

I'm a product designer building a flight-booking agent in public. Every comparison-shopping tool trains you to expect the same wall: origin, destination, dates, cabin, stops, price range, airlines, times — filled in before the tool will even try. My agent takes one sentence: *"AUS to JFK, one way, under $450, nonstop, prefer Delta."* No dropdowns.

Deleting the form was the easy part. Here's what had to get smarter so deleting it didn't just move the mess somewhere less visible:

**The budget can't be a vibe.** I first let the model *read* the number from your sentence loosely. It's now parsed by a small, deterministic rule before the model ever sees it — because the code that decides "auto-book or escalate" needs a real number, not the model's best guess at one, and two sources of truth (a settings field *and* your sentence) silently disagreeing is worse than one.

**Missing something? It asks — it doesn't assume.** If you leave out a return date, the agent stops and asks for it, the same way it'd stop to ask you to approve a booking. A quiet default is a UX shortcut that turns into a wrong ticket.

**No match? It names the one rule to change.** If nothing clears your bar, it doesn't loop retrying or dead-end — it says which constraint is binding ("nothing under $450 nonstop") and hands you one button to loosen it.

One box in front. Three small, boring decisions holding it up. That's the trade: the fewer fields you show someone, the more your code has to have earned the right to not ask.

Full write-up — the mechanism underneath 👇
[link to article]

→ What's a form or filter set you've replaced with a single input — and what had to get smarter underneath to make that safe?

#ProductDesign #AgenticAI #BuildingInPublic #DesignEngineering

[VIDEO/IMAGE: side-by-side — a conventional flight-search form vs. this agent's single text box producing the same ranked results. Caption: "Same job. One field instead of twelve."]

---
---

# LONG-FORM ARTICLE

## Why my flight-booking agent has one text box instead of Kayak's twelve

[IMAGE: side-by-side — a busy multi-field flight-search form (Kayak/Google Flights style) next to this agent's single text box producing the same ranked results. Caption: "Same job. One field instead of twelve."]

### Flight booking isn't the destination — automating a travel agent is
*Naming the endpoint up front is the same instinct behind every decision below: map the whole customer workflow first, then decide what to automate.*

I'm a Lead Product Designer moving from *prototyping* products to *building* agents, in public. The project I'm showing this week is a flight-booking agent — but flight booking isn't actually the destination, it's the hardest single leg to prove first. Where I'm headed: an agent that does an actual travel agent's job — take your destination, dates, budget, and travel style (adventurous, history-and-culture, slow-and-relaxed, whatever it is), reason through an entire trip, and hand you flights, hotels, and a day-by-day itinerary, not a spreadsheet of options to assemble yourself. This POC is **Phase 0** of that: prove the agent can handle the most constraint-heavy, highest-stakes leg — a real multi-airline search, ranked against your rules, with a visible act-vs-ask boundary — before it's ever trusted to plan a whole trip end to end. Today, that means: give it a trip and your constraints in plain language, it runs a real multi-airline search, ranks the results against your rules, and either books the best qualifying option itself or presents choices, depending on mode. Search is real; **booking is mocked**, always.

[IMAGE: a simple 3-step storyboard — "Flights (Phase 0, you are here)" → "Hotels (next)" → "Day-by-day itinerary (vision)" — sketch/roadmap styled, not a product screenshot. Caption: "This POC is step one of a longer trip."]

### The bet: a text box only works if the structure didn't disappear
*A form is honest about complexity because you can see every knob. A single input is only honest if those same rules still exist somewhere — just not on screen.*

Every flight-search tool I've ever designed around or against — Kayak, Google Flights, the airlines' own sites — solves the same problem with the same instrument: a form. Origin, destination, dates, cabin, stops, price band, airline checkboxes, sometimes time-of-day sliders. It works, and it's also the entire reason those tools feel like operating machinery. My bet for this agent was that a chat interface could replace that form *only if* the structure the form used to enforce didn't disappear — it had to move into code the user never sees. The next three sections are the three places I had to prove that bet true.

[IMAGE: clean screenshot of the actual home screen — just the single text input, nothing else on the page. Caption: "The whole intake surface."]

### The gate needs a fact, not a guess
*A settings field and a typed sentence quietly disagreed on my budget — that's when parsing it deterministically stopped being optional.*

Budget, stops, duration, and preferred airline are still first-class inputs to the ranking logic — they're just not things you fill in before the agent will try. The settings panel still exists, but I deliberately built it as a secondary control surface (guardrails you can adjust), not the primary intake. The clearest proof this wasn't just cosmetic: budget briefly lived in *both* places — a settings field and your sentence — and they disagreed the first time I tested it (settings said "no cap," my sentence said "under $650," and the cap silently lost). The deterministic gate that decides auto-book-or-escalate needs a real number to check against, not the model's best guess at one it half-read from your sentence. So I pulled budget out of settings entirely and now parse it deterministically from your sentence with a small, regex-based rule, guarded against misreading trip details as dollar amounts (11 test cases, including adversarial ones like "under 12h total" not getting misread as a budget). One source of truth, and it's the one the user actually typed.

[IMAGE: before/after of the Settings panel — a Budget field present, then removed and replaced by a one-line note pointing back to the prompt. Caption: "The field didn't move. It disappeared, on purpose."]

### Ask, don't assume
*The first time I forgot a return date, the agent stopped and asked instead of guessing — I hadn't built that for this case specifically; the mechanism already existed and just did its job.*

The first time I ran this live, I asked for a round trip and left out the return date. The agent didn't guess a date and search anyway; it asked. That's not a fallback I designed in advance for this exact gap — it's the same escalation surface (`ask_user`) that exists for booking approvals, doing exactly the job it was built for. It's the reason I'd rather a chat interface stop and ask than quietly resolve ambiguity in whatever direction is easiest to code: a wrong assumption about your return date is a wrong ticket, not a minor UX rough edge.

[VIDEO: 20–30s — type a one-line request with a missing detail (e.g. no return date) → agent asks for it → answer → ranked results appear, no form ever shown. Caption: "One box. It asks when it needs to — otherwise it doesn't make you fill anything in."]

### The gate decides in three tiers — never the model
*A numeric boundary like "20% over budget" only works if it's enforced the same way every time — that's not something I'd trust a model to do from memory, so it isn't the model's call.*

Ranking isn't the model's job, which is what makes naming the binding rule possible at all. A separate module runs deterministic code over every offer the search returns: hard filters for stops and total duration, a budget check with a built-in tolerance band, and a soft boost — never a filter — for your preferred airline. Every offer lands in exactly one of three tiers before the model ever touches a ranking: **eligible** (meets every hard rule), **tolerance** (over budget by up to 20%, with every other rule met — the one genuinely judgment-call tier, and never auto-bookable), or **rejected** (a hard rule broken, or over budget by more than 20%). The model only orders the survivors within their tier and narrates why; it never decides which tier an offer belongs to, because a precise numeric line like "20% over" isn't something I trust an LLM to enforce identically every time.

[IMAGE: architecture diagram — offers flow into the gate, the gate splits them into three labeled buckets (eligible / tolerance / rejected), the model only reorders within a bucket. Caption: "The model orders. It doesn't decide the bucket." (Deliberately a diagram, not the three-card screenshot — that one's reserved for Friday's post so the week doesn't repeat its strongest image.)]

### Zero matches: escalate, don't assume
*The agent's first instinct was to quietly re-search on its own and guess its way to an answer — I replaced that with an explicit hand-back to the user, because a human-in-the-loop moment only builds trust if it fires exactly when an assumption might be wrong, not just when the code hits a wall.*

Early on, a tight budget with no nonstop options put every offer in the rejected tier — zero eligible, zero tolerance — and the agent's first instinct (before I fixed it) was to quietly re-search on its own, burning a real API call and pre-empting a decision that should've been the user's. That's the failure mode I actually care about here: an agent that can't find an exact match shouldn't silently loosen a rule and retry, and it shouldn't just stall or dead-end either — it should say exactly what didn't work and hand the next move back to the person who set the rule in the first place. The fix does that: the agent now states plainly which rule is binding ("the search returned 103 options, but none cleared nonstop + under $20"), and the empty-state screen gives exactly two moves — adjust the rule, or search again with what you've got. No auto-retry.

Worth being precise about what's actually guaranteeing this, since it's a smaller claim than the booking boundary: *never auto-book anything outside the eligible tier* is enforced the hard way, by a permission check that runs before any booking call and simply won't allow it. *Stop and name the rule instead of re-searching* is enforced by instruction, not by a gate the model can't get past — a deliberate, honest distinction, not an oversight. But the principle underneath both is the same: when the agent isn't sure, or when its best next move would rest on an assumption that could be wrong, the trustworthy answer is to escalate to the person, not to quietly decide for them.

[IMAGE: the empty-state card, naming the exact binding rule with an "Adjust rules" / "Search again" pair of buttons. Caption: "No match isn't a dead end. It's a named rule and one button."]

[VIDEO: 15–20s — a search that returns zero eligible or tolerance offers → the agent names the exact binding rule → the empty-state card offers "Adjust rules" / "Search again," with no auto-retry in between. Caption: "No match isn't a guess in disguise. It's a named reason and a handoff."]

### The smaller the surface, the heavier the proof
*The fewer fields you show someone, the higher the bar for what your code has to prove before it's allowed to not ask.*

A wall of filters is honest about complexity — you can see every knob. A single text box is a bet that the same complexity is still being *handled*, just somewhere you don't have to look. That bet only pays off if you can point to the specific code doing the job the form used to do: a deterministic parser instead of a text field, a real question instead of a silent default, a named constraint instead of an empty screen. Remove the form and skip any one of those three, and you haven't simplified the experience — you've just hidden where it breaks.

[IMAGE: a small 3-row recap graphic — "Filter removed → what replaced it": Budget field → deterministic parser · Silent default → ask_user · Dead-end screen → named constraint + button. Caption: "One box in front. Three things holding it up."]

*Week 2 of building in public. Next: how the boundary between acting and asking is enforced where a UI can't quietly move it.*

---

### About the author

[IMAGE: professional headshot]

I'm a Lead Product Designer with 15+ years in B2B FinTech, designing the exception queues, approval flows, and "are you sure?" moments that decide when software acts on its own and when it stops to ask. This project is that same question, built in public. If you're hiring for agentic or workflow-automation design, or just want to compare notes on where you draw the act-vs-ask line, I'd like to hear from you.
