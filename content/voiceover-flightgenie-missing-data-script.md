# Voiceover Script — "FlightGenie Missing Data" Demo

Source video: `content/recordings/flightgenie-missing-data.mov` (25.1s, no existing audio)
Target: ElevenLabs TTS, timed to match video beats below. Paired with `medium-2026-07-31-trust-boundary.md`.

## Timeline reference (from video)

| Time | On-screen |
|---|---|
| 0:00–0:03 | Request submitted: "AUS → JFK next Saturday, nonstop, roundtrip, under $650" — no return date given; "Before I Act" panel confirms autobook-for-exact-match mode |
| 0:03–0:09 | Agent starts: "Hi there. I'll start by getting the tools I need to process your request." |
| 0:09–0:10 | Agent flags the gap: "I have everything except one detail: for a roundtrip I need your return date." |
| 0:10–0:11 | "FlightGenie has a question" card appears, asking the traveler to confirm the departure date and supply a return date |
| 0:11–0:20 | Traveler types the clarification into the card |
| 0:20–0:25 | Answer submitted; card shows "You answered: yes july 25 depart and return aug 1" |

## VO script (read top to bottom, cues are timing guides only — do not read the bracketed timestamps aloud)

**[0:00]**
The first time I ran this live, I left out the return date.

**[0:07]**
The agent didn't guess and search anyway.

**[0:09]**
It stopped.

**[0:10]**
It asked.

**[0:11]**
Not a fallback I built for this exact gap — the same escalation surface that handles booking approvals, doing exactly the job it was built for.

**[0:20]**
A wrong assumption about your return date isn't a UX rough edge. It's a wrong ticket.

---

## Clean copy-paste block (for ElevenLabs — no timestamps)

The first time I ran this live, I left out the return date. The agent didn't guess and search anyway. It stopped. It asked. Not a fallback I built for this exact gap — the same escalation surface that handles booking approvals, doing exactly the job it was built for. A wrong assumption about your return date isn't a UX rough edge. It's a wrong ticket.

## Pacing notes

- Word count: 65 words.
- At a brisk, declarative pace (155–165 wpm — faster than the Autobook script's 140–155 wpm, since these are short punchy sentences), this reads in **~24–25 seconds** — matches the 25.1s video length closely.
- The two-word beats ("It stopped." / "It asked.") should land right as the "I have everything except..." message and the question card appear (0:09–0:11) — give them a real pause before and after, don't rush through them as filler.
- If ElevenLabs renders noticeably short, favor adding a beat of silence after "It asked." over speeding up the rest — that pause is doing narrative work (the agent stopping), not just filling time.
- Voice suggestion: same measured, confident register as the Autobook script — first-person reflection, not ad copy. Slightly more clipped/declarative given the shorter sentences.
