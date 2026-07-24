# FlightGenie Demo Voiceover Script (Draft v1)

Two clips, two scripts. Timestamps are anchor points matched to what's on screen in each
video — not rigid cuts. ElevenLabs generation won't land on these to the frame, so treat
them as pacing guides: read a line, let the beat land, move to the next.

Assumption baked into the tone: this is aimed at a design/PM/agentic-AI audience (LinkedIn,
portfolio), not consumer flight-shopper marketing. The point of the reel is the trust
boundary — automated vs. human-in-the-loop — since that's the actual thesis of the project
(PRD §8). Flag if you want it pitched more consumer-facing instead.

---

## Clip 1 — Human-in-the-Loop (58s)

**[0:00]**
This is manual-review mode. The agent can search and rank flights — but every booking still needs my sign-off.

**[0:08]**
I ask for a round trip, Austin to JFK, nonstop, under six-fifty.

**[0:16]**
Watch what happens next. The request is ambiguous — which Saturday, and there's no return date — so instead of guessing, it stops and asks.

**[0:24]**
I answer once, and it moves.

**[0:28]**
Every offer gets run through a hard rules gate — not a judgment call, a deterministic check against my constraints.

**[0:36]**
Two hundred twenty-six offers came back. The ones that broke a rule, or blew the budget, are labeled and visible — nothing gets buried.

**[0:46]**
Its top pick: lowest fare, shortest total travel time, best departure window — and it tells me exactly why.

**[0:52]**
Then it stops. The booking sits right here, waiting on my tap — because in this mode, I make the call, every time.

---

## Clip 2 — Automated Mode (52s)

**[0:00]**
Same agent, same rules — but now it's allowed to act on its own, when it's confident.

**[0:02]**
Before anything runs, I set the guardrails myself: nonstop only, twelve hours max, budget capped at six-fifty.

**[0:08]**
I ask for a round trip, Austin to JFK, next Saturday, under budget.

**[0:16]**
It still won't guess. The date's ambiguous and there's no return date — so it pauses and asks, even in automated mode.

**[0:24]**
Once I answer, it searches, ranks against my rules, and decides.

**[0:28]**
Two hundred twenty-six offers, filtered down to the ones that actually qualify.

**[0:36]**
Everything that broke a rule or ran over budget still gets shown, not hidden — I can see exactly what got ruled out, and why.

**[0:46]**
Because this option met every constraint, it books it — automatically.

**[0:50]**
Confirmed. Mocked, obviously — no card charged, no ticket issued. But the decision, and the reasoning behind it, are right there on screen.

---

## Notes / open questions for you

- Word counts (~135 words / clip 1, ~125 / clip 2) sit at a brisk-but-natural read for
  58s / 52s. If your ElevenLabs voice reads slower than ~145 wpm, trim the "labeled and
  visible — nothing gets buried" and "still gets shown, not hidden" lines first — they're
  the most cuttable without losing the thesis.
- No outro/CTA line included (e.g. "link in comments," "built with Claude Agent SDK +
  Duffel") — didn't want to presume you want one or what it'd say. Easy to add to either
  clip's last beat.
- If these two clips get stitched into one combined post instead of run separately, I'd
  add a ~4s cold open before Clip 1 framing the contrast ("Same agent. Two trust modes.")
  — say the word and I'll draft it.
