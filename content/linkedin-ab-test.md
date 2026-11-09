# FlightGenie LinkedIn hook comparison

## Goal

Compare a demo opening with a workflow opening while keeping the post's claim and simulation disclosure consistent.

This is a directional comparison of organic posts. Sequential posts do not isolate the hook from changes in audience, feed distribution, or prior exposure.

## Openings

Choose one opening per post. Use the same shared body and first comment.

| Variant | Opening | Focus |
|---|---|---|
| A1 | I built a flight agent that searches live fares and simulates booking without approval when the configured rules pass. | Working behavior |
| A2 | This FlightGenie demo shows where an agent can act and where it needs approval. Every booking is simulated. | Oversight interaction |
| A3 | Automated mode can book an eligible offer. Manual review asks first. Both paths return simulated confirmations. | Two modes |
| B1 | I can generate features faster than I can verify them. Building FlightGenie made that gap concrete. | Verification gap |
| B2 | Every product decision in this project still passed through me. Faster generation did not give me independent validation. | Decision bias |
| B3 | I used AI to produce the spec, interface, and agent code. I still needed to check both the implementation and the idea. | Builder workflow |

## Shared body

FlightGenie is a consumer flight-booking proof of concept I built to test booking permission and human review.

I used AI across the product brief, design system, prototype, and agent code. The working app searches live fares and enforces configured booking rules in code. Booking is always simulated.

I still make the product decisions and review much of the generated UI by hand. That leaves two separate questions: did I build the behavior correctly, and does that behavior solve a real travel need?

My next experiments address both:

- Define smaller build tasks with explicit verification checks.
- Calibrate a separate model reviewer against my own review.
- Put the concept in front of travelers before making claims about demand.

#AgenticAI #ProductDesign #BuildingInPublic

## First comment

The [repository](https://github.com/alokjethanandani/flight-booking-agent) includes the permission gate, simulated booking checks, and recorded design decisions.

What evidence would you require before allowing an agent to book automatically?

## Comparison protocol

| Rule | Purpose |
|---|---|
| Use the same weekday and time, 7 days apart | Reduce timing differences while acknowledging repeat exposure |
| Keep video, body, first comment, and hashtags identical | Limit intentional differences to the opening |
| Use the same distribution approach | Avoid boosting only one variant |
| Record metrics at 72 hours | Compare posts at the same age |
| Select the primary measure before posting | Avoid choosing a favorable measure after seeing results |

The 7-day gap and 72-hour window are protocol choices. They are not guarantees that other effects disappear.

## Measures

| Measure | Use | Limit |
|---|---|---|
| Engagement rate: reactions, comments, and reposts divided by impressions | Primary comparison | Reach and audience composition still differ |
| Substantive comments | Review the quality of the discussion | Requires a consistent coding rule |
| Impressions | Record distribution differences | Cannot identify why distribution changed |
| Profile views and follows, where attributable | Assess relevance to the publishing goal | Attribution may be incomplete |

Record the counts and denominators. Treat one post per variant as a hypothesis for another comparison. Do not describe the difference as a causal effect of the hook.

## Next experiment

If the result informs future writing, repeat opening styles across the series and compare patterns. Keep user validation separate from post engagement. A post receiving attention does not establish product demand.
