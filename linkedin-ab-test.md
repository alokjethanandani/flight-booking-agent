# FlightGenie — LinkedIn Hook A/B Test

**Goal:** Test whether a *demo-led* hook or a *confession-led* hook drives more engagement, without changing anything else about the post.

**Manipulated variable:** the first 1–2 lines only.
**Held constant:** the video, the body, the CTA, the hashtags, the posting time-of-day, the "repo in comments" first comment.

---

## Arm A — CONTROL (demo hook)

Pick ONE opening. It attaches to the shared body below.

### A1 — Play-by-play
> ▶️ That's an AI agent searching and booking a flight — start to finish, no human touching it.
>
> No forms. No twelve open tabs. Just intent in, itinerary out.

### A2 — Contrast
> ▶️ Booking a flight, the way it should work: you say what you want, the agent does the rest.
>
> What you're watching is a working POC — and the way it got built is the actual story.

### A3 — Curiosity
> ▶️ 15 seconds of an AI agent booking a flight on its own.
>
> Cool to watch. But the part I can't stop thinking about is what building it taught me about *me*.

---

## Arm B — EXPERIMENT ("I'm the bottleneck" hook)

Pick ONE opening. It attaches to the shared body below.

### B1 — Blunt confession
> I built an AI agent that books flights on its own.
>
> Then I realized the slowest, most biased part of the whole system is me.

### B2 — Contrarian
> The bottleneck in AI-assisted product work isn't the AI.
>
> It's the human in the loop. I know, because for the last few weeks that human was me — and here's the agent I built to prove it. ▶️

### B3 — Sample-size angle
> I shipped an AI flight-booking agent fast — PRD, design system, prototype, code — almost entirely by prompting.
>
> I also made every single decision myself. Sample size: 1. That's the problem. ▶️

---

## Shared body + CTA

> It's an early POC + vision prototype for **FlightGenie**, a consumer flight-booking agent I've been building.
>
> Over the last few weeks I've used AI to produce nearly every artifact in the stack:
> — the PRD and design brief
> — a custom design system (shadcn/ui base + my own components)
> — the working prototype
> — the agent code, including its "book automatically vs. ask a human" oversight logic
> — even the Claude skills I used to build the rest
>
> I've gotten genuinely good at prompt engineering. And that's exactly the problem.
>
> **I'm the bottleneck in my own workflow.** Every decision still routes through me — which makes me the single biggest source of bias in what gets built. Fast, but a sample size of one.
>
> Next chapter: designing myself out of the loop in two places —
> 1️⃣ An internal loop to automate more of the design → build cycle
> 2️⃣ An external loop to validate (or kill) the idea — the part I have zero of today
>
> Part 1 of a build-in-public series. Follow along if AI-assisted building (and its failure modes) is your thing.
>
> Repo in the comments 👇

**Note for Arm B:** since the bottleneck line is now your *hook*, compress it in the body so you're not repeating yourself verbatim. Replace the bold "I'm the bottleneck…" sentence with:
> Which brings me back to the opening: I'm the constraint here. Fast, but a sample size of one.

### First comment (both arms, identical)
> Code's here if you want to poke around — the most interesting part is the oversight logic: the "book automatically vs. stop and ask a human" trust boundary that decides when the agent acts on its own and when it escalates.
>
> https://github.com/alokjethanandani/flight-booking-agent
>
> Feedback and hard questions welcome 👇

---

## How to run it so the result actually means something

### The core problem
You can't run both at once to the same people. So you run them **sequentially and identically**, freeze the metrics at a fixed age, and compare *rates*, not raw counts.

### Protocol
| Rule | Why |
|---|---|
| Post Arm A and Arm B **7 days apart** | Lets audience/feed reset; reduces "already saw this" fatigue |
| **Same weekday, same time-of-day** (e.g. both Tue 8:30am) | Removes day-of-week and time-of-day effects — LinkedIn's biggest organic confounds |
| Identical video, body, CTA, hashtags | Isolates the hook as the only variable |
| Don't cross-link or boost one | Prevents contaminating one arm with the other's audience |
| Freeze metrics at a fixed window: **snapshot at 72h**, optional 7-day tail | Posts mature at different rates; compare at equal age, not equal calendar date |

### What to measure
Your hook only affects the **top of funnel** — whether someone stops, expands, and reacts. Both posts have the same body/CTA, so judge the hook on:

| Metric | Role | How to read it |
|---|---|---|
| **Engagement rate** = (reactions + comments + reposts) ÷ impressions | **Primary** | Normalizes for reach differences. This is your headline number. |
| **Comments** | **Quality signal / tiebreaker** | Hardest engagement to earn; best proxy for "the hook made people *think*." |
| Reposts | Amplification | Did the hook make people want to be seen sharing it? |
| Impressions / reach | Guardrail | Big gap here = the algorithm, not the hook, moved — flag as a confound |
| New followers + profile views | Ties to your CTA | Your actual goal is "follow for the series" — track this per post |

**Decide the primary metric (engagement rate) and the snapshot window (72h) *before* you post.** Picking the metric after you see the numbers is how you fool yourself.

### The honest caveat
N = 1 post per arm. Even a visible gap could be noise. Treat the winner as a **hypothesis**, not a verdict.

### If you want real signal (optional)
- **Cheap + rigorous:** make "hook style" a recurring variable across the whole series. Alternate demo-led vs. confession-led over 8–10 posts, tag each in a spreadsheet, and compare the *averages*. Aggregation beats any single head-to-head.
- **True RCT (paid):** LinkedIn Campaign Manager can split-test two creatives to a randomized audience. Costs money and the audience isn't your organic followers — so it answers "which hook converts strangers," not "which hook lands with my network." Different question; know which one you care about.

### Bottom line
Best realistic setup: two posts, 7 days apart, same slot, everything-but-the-hook identical, engagement rate at 72h as the call, comments as the tiebreaker — read as directional. Use the series-level aggregation if you want something you'd actually stake a claim on.
