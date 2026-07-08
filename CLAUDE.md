# Project Instructions — Consumer Flight-Booking Agent

Governs how Claude works in this project across design, build, test, and launch. Source of truth for scope/architecture is `Mini-PRD-Flight-Booking-Agent.md` — read it before major decisions. If it's silent on something, ask; don't guess.

## 1. Non-negotiable guardrails

- **`book_flight` is always mocked.** No code path may ever call Duffel's paid `order` endpoint. A live Duffel token is for search only. Before marking any booking-related work done, verify (grep/test) that no real order call is reachable.
- **No real payment, ticketing, or PNRs.** Ever, even for testing.
- **No BILL IP** in this project — wholly independent domain.
- **Reversibility check:** before anything destructive or hard-to-undo (deleting files, force-pushing, rewriting the PRD's locked decisions, spending non-trivial API credits, publishing content externally) — show the plan, flag what's irreversible, wait for explicit "proceed."

## 2. Scope discipline

v1 scope and non-goals are fixed in PRD §3. Non-goals: real payment/ticketing, hotels, cars, multi-city, loyalty/points, seat selection, accounts/production auth, the B2B "policy mode" variant.

If a request would add any of these — say so explicitly ("this is scope creep per the PRD non-goals") and require an explicit override before proceeding. Don't quietly absorb scope expansion.

## 3. Build workflow

Follow the phased plan in PRD §7 (Phase 0 → 5) in order. Don't jump ahead to a later phase without a working, demoable result from the current one.

At the end of each phase: recap what was built, confirm it's demoable, get a lightweight go-ahead before starting the next phase.

If Alok says scope or constraints changed mid-phase, stop and re-confirm the affected PRD sections before writing more code — don't assume the old constraints still hold.

## 4. Locked technical decisions (PRD §10)

TypeScript end-to-end · Claude Agent SDK · Duffel TS client (`@duffel/api`) · UI in v0/Lovable · one-way + round-trip only.

Treat these as settled. If one looks wrong once you're in the code, flag it and explain why — don't silently deviate.

## 5. Testing bar

Each phase's "done" = demoable end-to-end, not production-hardened (per PRD success criteria — this is a POC, not a shipped product). Still, for anything touching the booking path, prove the mock boundary holds — that's the one guardrail that isn't optional.

## 6. Working style

- Show reasoning for ranking/scoring logic and automated-vs-escalate routing — that logic *is* the point of the project (PRD §8).
- No sycophancy: if a shortcut undermines the oversight-legibility goal (the auto-vs-ask boundary being visible and explainable), say so instead of shipping it quietly.
- Keep a running `BUILD-LOG.md` in this folder — decisions made, what's done, open questions. Update it at the end of each session or phase so context survives across sessions.

## 7. Launch/demo bar

"Done" means: both modes (automated + HITL) work end-to-end, the oversight model is visible in the UI, constraints are configurable, mock confirmations render correctly, and there is no reachable path to a real Duffel order call. Screen-recordable is the actual finish line — not feature completeness.
