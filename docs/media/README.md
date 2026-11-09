# Demo media

This folder holds screenshots and recordings for the [project README](../../README.md). Capture implemented behavior and label static concepts separately.

## Recording plan

Pair each MP4 with a PNG poster at the same base filename. Link the poster to the recording when adding it to the README.

```markdown
[![Pre-action plan](pre-action-preview.png)](pre-action-preview.mp4)
```

| Files | Capture |
|---|---|
| `pre-action-preview.{png,mp4}` | The plan stating when the agent can act before a booking attempt |
| `default-hitl.{png,mp4}` | A new session in manual review and the mode control |
| `status-tiers.{png,mp4}` | Eligible, over-budget, and rejected offers with their status labels |
| `escalation-callout.{png,mp4}` | An over-budget approval request, the user's answer, and the result |

## Supporting screenshots

| File | Capture |
|---|---|
| `constraints-guardrails.png` | Current Settings fields and the last search's tier counts |
| `narrated-loop.png` | Search, ranking, and decision progress |
| `mock-confirmation.png` | The simulation label and simulated cancellation control |
| `why-this-rank.png` | Expanded classification reasons |

Live impact hints and close-call signals are not implemented. Do not present them as working features in recordings. Keep the simulation label visible whenever a booking appears.
