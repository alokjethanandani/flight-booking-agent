# FlightGenie demo narration

Status: Draft for two existing clips. Audience: product, design, and engineering reviewers. Timestamps follow the original recording plan and need a playback check after narration changes.

Counts and fares refer to the recorded take. Confirm them against the final footage. Keep model interpretation distinct from the budget, stops, and duration checks enforced in code.

## Clip 1: manual review, 58 seconds

**[0:00]**
In manual review, the agent searches and ranks flights. Every simulated booking needs my approval.

**[0:08]**
I request a round trip from Austin to JFK, nonstop, under six-fifty.

**[0:16]**
The request leaves the dates unclear. The agent asks which Saturday I mean and when I want to return.

**[0:24]**
I clarify the dates, and the search continues.

**[0:28]**
Code checks each offer against the configured budget, stops, and total duration.

**[0:36]**
This recording returned two hundred twenty-six offers. I can inspect the eligible, over-budget, and rejected results.

**[0:46]**
The agent recommends a flight and explains the tradeoffs.

**[0:52]**
It waits for my approval before booking. The confirmation is simulated. No ticket is issued and no card is charged.

## Clip 2: automated mode, 52 seconds

**[0:00]**
In automated mode, an eligible offer can proceed without my approval.

**[0:02]**
I set nonstop flights and twelve hours total in Settings. The request sets the budget at six-fifty.

**[0:08]**
I request a round trip from Austin to JFK.

**[0:16]**
The dates still need clarification. The agent asks for the missing information before searching.

**[0:24]**
Once I answer, it searches live fares and checks the configured rules.

**[0:28]**
This recording returned two hundred twenty-six offers, grouped by eligibility.

**[0:36]**
I can inspect the over-budget and rejected options, including the reasons they failed a check.

**[0:46]**
The proposed flight passes, so booking proceeds automatically.

**[0:50]**
The confirmation is simulated. No ticket is issued and no card is charged.

## Recording instructions

Use a measured product-demo read. Keep the simulation disclosure in both clips. Read only the narration, without timestamp labels.

The shorter script leaves room for search latency and pauses. Check the rendered audio against playback rather than treating word count as proof of timing.

If the clips are combined, introduce them with: "The same agent follows two approval policies. Every booking is simulated."
