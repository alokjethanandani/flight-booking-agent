# Voiceover Script — "FlightGenie Autobook" Demo

Source video: `content/recordings/FlightGenie Autobook.mp4` (90.0s, no existing audio)
Target: ElevenLabs TTS, timed to match video beats below.

## Timeline reference (from video)

| Time | On-screen |
|---|---|
| 0:00–0:20 | Homepage; user types a long, multi-constraint request into the search box |
| 0:21–0:26 | Request submitted; "Before I Act" panel confirms autobook-for-exact-match mode; agent starts working |
| 0:27–0:29 | Agent flags the missing return date, asks the traveler directly |
| 0:30–0:43 | "FlightGenie has a question" card; traveler types the clarification (following weekend, return Aug 12) |
| 0:44–0:51 | Agent confirms the resolved dates, begins searching |
| 0:51–0:60 | 237 offers returned, ranked; Preferred Pick surfaces ($575 AA, nonstop) |
| 0:60–0:75 | Traveler can expand 17 other eligible options, over-budget "within tolerance" options with reasoning, and 219 rejected offers with reasons |
| 0:75–0:78 | Booking confirmed screen — confirmation number, PNR, simulated badge |
| 0:78–0:90 | Agent's written explanation of why this flight won |

## VO script (read top to bottom, cues are timing guides only — do not read the bracketed timestamps aloud)

**[0:00]**
FlightGenie's auto-book mode starts with a real request, not a form.

**[0:07]**
The traveler describes a complex trip in plain language — nonstop, round trip, under six-fifty, with specific departure and arrival windows on both legs.

**[0:21]**
FlightGenie parses all of it before it touches a single tool.

**[0:24]**
But it also catches what's missing — an outbound day, next Saturday, with no return date at all.

**[0:30]**
Instead of guessing, the agent stops and asks. That's the auto-versus-ask boundary at work: assume when it's safe, escalate when it's not.

**[0:44]**
The traveler clarifies — it's actually the following weekend. FlightGenie locks in the real dates and searches.

**[0:51]**
Two hundred thirty-seven live offers come back. The agent ranks every one against the traveler's rules — price, stops, duration, and now, time windows too.

**[0:60]**
It surfaces a preferred pick, but the reasoning stays visible: other eligible options, the ones that missed budget by a few percent, and the ones that broke a rule outright, like connecting flights the traveler ruled out.

**[0:75]**
Nothing here is a black box — you can see exactly why one flight made the cut and another didn't.

**[0:78]**
With a fully eligible option on the table, FlightGenie books it automatically. No human needed.

**[0:82]**
And it explains itself: the only nonstop, on-budget flight that actually fit both time windows, at the lowest fare available.

---

## Clean copy-paste block (for ElevenLabs — no timestamps)

FlightGenie's auto-book mode starts with a real request, not a form. The traveler describes a complex trip in plain language — nonstop, round trip, under six-fifty, with specific departure and arrival windows on both legs. FlightGenie parses all of it before it touches a single tool. But it also catches what's missing — an outbound day, next Saturday, with no return date at all. Instead of guessing, the agent stops and asks. That's the auto-versus-ask boundary at work: assume when it's safe, escalate when it's not. The traveler clarifies — it's actually the following weekend. FlightGenie locks in the real dates and searches. Two hundred thirty-seven live offers come back. The agent ranks every one against the traveler's rules — price, stops, duration, and now, time windows too. It surfaces a preferred pick, but the reasoning stays visible: other eligible options, the ones that missed budget by a few percent, and the ones that broke a rule outright, like connecting flights the traveler ruled out. Nothing here is a black box — you can see exactly why one flight made the cut and another didn't. With a fully eligible option on the table, FlightGenie books it automatically. No human needed. And it explains itself: the only nonstop, on-budget flight that actually fit both time windows, at the lowest fare available.

## Pacing notes

- Word count: 218 words.
- At a natural narration pace (140–155 wpm), this reads in **~84–90 seconds** — matches the 90.0s video length.
- If ElevenLabs renders noticeably short or long, use its speed/stability slider (aim for 0.9–1.0x) rather than cutting words — the line breaks above are already placed at the video's natural beats, so trimming mid-line will throw off sync.
- Voice suggestion: measured, confident, product-demo register — not hyped. This is a POC walkthrough, not an ad.
