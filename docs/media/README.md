# README media

Assets referenced by the "Key UX decisions" section of the top-level [`README.md`](../../README.md). Captured in **Phase 5** (demo + writeup).

## Tier 1 — short screen recordings (`.mp4`) + poster frame (`.png`)

The README uses a poster-links-to-video pattern (`[![poster](x.png)](x.mp4)`) so it renders everywhere, including GitHub, where a repo-relative `<video>` tag would not autoplay-embed. Drop both files at these names:

| File | Shows |
|---|---|
| `pre-action-preview.{png,mp4}` | The agent stating what it will do before it acts |
| `default-hitl.{png,mp4}` | Session opening in HITL; the mode toggle |
| `status-tiers.{png,mp4}` | eligible / tolerance / rejected badges + escalation styled as warning, not error |
| `escalation-callout.{png,mp4}` | "I paused because X" with the Approve / Adjust / Alternatives action row |

## Tier 2 — screenshots (`.png`)

| File | Shows |
|---|---|
| `constraints-guardrails.png` | Constraint edit with a live impact hint |
| `narrated-loop.png` | Searching → Ranking → Deciding step states |
| `mock-confirmation.png` | Simulated-booking marker + cancel/undo |
| `why-this-rank.png` | Progressive-disclosure reasoning + close-call note |

Once a GitHub-hosted asset URL exists (drag-drop into an issue/PR), a Tier-1 entry can be swapped to a native `<video>` embed if autoplay preview is wanted.
