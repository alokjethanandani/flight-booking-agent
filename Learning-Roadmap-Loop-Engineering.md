# Learning Roadmap — Loop Engineering + Two-Model Build/Verify

**Owner:** Alok · **Drafted:** July 14, 2026 · **Status:** Working doc (update as you run each experiment)

> Goal: close the gap named in the Week 1 write-up — *I can generate features faster than I can verify them.* This roadmap gets me from hand-verifying prompted output to an automated **plan → build → verify** loop, with a **separate model** doing the verifying.
>
> Scope note: this is about my **development workflow**, not the flight-agent product scope. It does not touch the PRD's locked product decisions or guardrails (booking stays mocked; the code-level mock boundary is exactly the kind of check the verify loop should be running every iteration).

---

## 0. Where I am today (baseline)

| Capability | Status today | Target |
|---|---|---|
| Intent → spec (meta-prompt → PRD) | ✅ Solid — PRD drives agent decisions | Keep; add per-story specs |
| Feature/UI generation | ✅ Fast via prompting + v0/Lovable | Keep |
| Automated verification of generated output | ❌ Hand-eyeballed | **Automated verify step per unit** |
| Core trust logic (mock boundary) | ✅ 29 deterministic tests | Extend pattern to feature work |
| Plan → build → verify loop | ❌ Manual, one big blob | **Small, looped, self-checking units** |
| Second model as verifier | ❌ One model does everything | **Generator ≠ verifier** |
| Git PR/commit automation | ❌ Manual | Automated commits per green loop |

The two ✅ testing rows matter: I already have proof that a *narrow, well-defined* check (the mock boundary) can be automated and trusted. The roadmap is about generalizing that from one guardrail to the whole build.

---

## 1. Concepts, grounded

### 1a. Loop engineering (the "Ralph Wiggum" loop)

Origin: technique from Geoffrey Huntley (mid-2025), since formalized by Anthropic as an official plugin. The core mechanic is deliberately dumb: **feed the agent a prompt, let it work, loop it again — and keep progress in files and git, not in the model's context window.** Each iteration starts with fresh context and reads the current state (code + notes + failing tests) off disk. Failures get piped back in, so the model is forced to confront its own mess until it converges.

Why it works: it sidesteps context-window rot. Instead of one long, degrading conversation, you get many short, fresh passes over an accumulating, on-disk source of truth. Brute force plus persistence.

Why it's dangerous without discipline: an un-bounded loop on a fuzzy task burns tokens and drifts. The loop is only as good as (a) how small the unit of work is and (b) how *decisively* each pass can be judged done. That's the whole game — see §3.

### 1b. Generator ≠ verifier (the "second opinion")

Pattern from current agentic practice (LLM-as-judge / generator-verifier): one model produces a candidate, a **different** model grades it against explicit criteria (a rubric), pass/fail per criterion. Two reasons it's worth the extra call:

- **Independence** — the model grading the work isn't the one that produced it, so it's not marking its own homework. Self-review shares the generator's blind spots.
- **Cost asymmetry** — *writing* the rubric/plan wants a strong frontier model; *grading against* a clear rubric is easy enough that a cheaper/faster model does it nearly as well. So the natural split is **strong model plans + builds, lighter/different model verifies** — which is also exactly your Task 2 ("one LLM for building vs. testing + deploying").

Practical model-split options to test:
- **Same family, different tiers:** e.g., a frontier model generates, a smaller/faster one verifies against the rubric.
- **Cross-vendor:** generator and verifier from different providers, to maximize independence of blind spots.
- Decide empirically (§4 metrics) — don't assume cross-vendor is worth the integration cost until the numbers say so.

### 1c. What makes a *good* loop (your hypothesis, sharpened)

Your framing — positive loop = small, verifiable tasks; negative loop = large, unverifiable tasks — is the right axis. Making it operational:

| | Converging loop (want) | Diverging loop (avoid) |
|---|---|---|
| Task size | One user story / one component | "Build the booking flow" |
| Done signal | A test / rubric returns pass/fail | "Looks right" |
| Verifiability | Machine-checkable (tests, types, lint, boundary grep) | Needs a human to judge |
| Failure mode | Loop exits red → you see exactly what failed | Loop runs forever or declares false victory |
| Exit condition | Explicit: green tests **and** verifier pass | Vague / token budget runs out |

**The engineering is keeping every task inside the left column.** A story that can't be given a machine-checkable done-signal isn't ready to be looped — it needs to be split or spec'd further first. That decomposition step is where your PRD-first muscle transfers directly.

---

## 2. Target loop (what I'm building toward)

```
PRD  ──►  decompose into small user stories (each independently verifiable)
             │
             ▼
   ┌──────────────────────────────────────────────┐
   │  For each story, loop until green:            │
   │                                               │
   │   PLAN     (generator model: strong)          │
   │     └─ write/refresh the story spec + rubric  │
   │   BUILD    (generator model)                  │
   │     └─ implement; state lives in files + git  │
   │   VERIFY   (verifier model: separate)         │
   │     ├─ run tests / types / lint / boundary    │
   │     └─ grade output against the rubric        │
   │                                               │
   │   green? ─► commit + open PR, next story      │
   │   red?   ─► pipe failures back, loop again    │
   │            (cap iterations; escalate to me)    │
   └──────────────────────────────────────────────┘
```

Design constraints I care about (my oversight POV applied to my *own* toolchain):
- **The loop must be legible.** I want to see, per iteration, what was tried and why it passed/failed — same principle as the agent's oversight trace.
- **Bounded, not unattended.** Hard iteration cap; on repeated failure it escalates to me instead of grinding. (The negative-loop guardrail, enforced in code.)
- **The mock boundary is a permanent verify check.** Every loop runs the existing "no real Duffel order" grep/test. The verify step is the natural home for guardrails, not just correctness.

---

## 3. Phased plan

Deliberately mirrors the PRD's "each phase ends in something demoable" discipline. Don't advance until the current step is real.

### Phase A — Manual loop, one model (prove the shape)
- Take **one** small, already-scoped story (e.g., the date-range picker component, or a single ranking tie-breaker rule).
- Run plan → build → verify **by hand**, one model, but write the **verify step as a real command** (test + typecheck + lint) rather than eyeballing.
- **Done when:** the story has a machine-checkable done-signal you trust, produced without you reading the diff line by line.
- *Why first:* you can't automate a loop you haven't run manually. This also forces the "is this story verifiable?" question early.

### Phase B — Add a separate verifier model (the second opinion)
- Keep the loop manual, but split roles: strong model plans/builds, a **different** model grades the output against a written rubric for that story.
- Compare the verifier's verdict to your own judgment on 5–10 stories. Where do they disagree? That calibration *is* the deliverable.
- **Done when:** you trust the verifier enough to let a "pass" mean something — and you know its failure modes.
- *Decision to record:* which model split (tier vs. cross-vendor) earned its keep.

### Phase C — Automate the loop (Ralph-style)
- Wrap plan → build → verify in an actual loop that reads/writes state to files + git, fresh context each pass, failures piped back in.
- Start with a **hard iteration cap** and manual kickoff per story. No overnight autonomous runs yet.
- **Done when:** one story goes red → loops → green → commits, with you only reading the final result.
- *Guardrail:* the mock-boundary check runs every iteration; a loop that can't go green in N passes escalates, doesn't grind.

### Phase D — Automate commit/PR + string stories together
- On green, auto-commit with a message derived from the story + open a PR. (Closes your other named gap: no GitHub push/PR automation.)
- Run a small **batch** of independent stories through the loop unattended, with the escalation guardrail live.
- **Done when:** a demoable "I gave it 3 small stories and got 3 reviewed PRs" run — the week-1-to-week-N story for the next post.

### Phase E — Retro + write-up
- Measure against §4. Which loops converged, which diverged, and what predicted it?
- Feed the answer back into how you decompose the *next* PRD. Publish (this is content beat #2).

---

## 4. How I'll know it's working (metrics, not vibes)

| Question | Metric |
|---|---|
| Are tasks actually verifiable? | % of stories with a machine-checkable done-signal (target: ~all) |
| Do loops converge? | Median iterations-to-green per story; % that hit the cap and escalate |
| Is the verifier trustworthy? | Agreement rate between verifier verdict and my own review; count of false "pass" (worst failure) |
| Is generation still the fast part? | Wall-clock: generate vs. verify time per story (the asymmetry I'm trying to fix) |
| Is the cost split worth it? | Tokens/$ per green story: strong-plans-builds + light-verifies vs. one-model-does-all |
| Did I actually save human time? | Diffs I read line-by-line before vs. after |

The single metric I care most about: **false-pass rate.** A verifier that waves through broken work is worse than no verifier, because it converts "slow but trusted" into "fast and wrong."

---

## 5. Open questions (decide as I go)

- **Model split:** same-family tiers or cross-vendor for generator vs. verifier? (Answer in Phase B with data.)
- **Rubric authorship:** who writes the per-story rubric — me, or the planning model? If the generator writes its own rubric, does independence collapse?
- **Verifier scope:** does the verifier only run checks, or also *propose* fixes? (Proposing fixes blurs it back toward a second generator.)
- **Where the loop lives:** local bash loop vs. the Anthropic Ralph plugin vs. the Agent SDK's own harness. (Reuse what the project already uses before adding a tool.)
- **UI verification:** tests cover logic; how do I give *visual* output a machine-checkable done-signal (visual regression? component-contract tests?) — this is the hard part and probably the last to automate.

---

## 6. First concrete step

Pick one already-scoped, verifiable story and run **Phase A by hand this week** — plan → build → verify with the verify step as a real command. Everything downstream depends on proving a single unit can be trusted without me reading the diff.

*Reference: the Week 1 show-and-tell (`content/LinkedIn-Week1-Show-and-Tell.md`) names the gap this roadmap closes.*
