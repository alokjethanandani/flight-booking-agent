# Learning roadmap: build and verification loops

Owner: Alok Jethanandani. Drafted: July 14, 2026. Status: Planned experiments. The baseline below records the original assessment.

## Purpose

I can generate features faster than I can verify them. I want to test whether smaller tasks, explicit checks, and a separate reviewer reduce manual verification without increasing missed defects.

This roadmap concerns my development workflow. The [product brief](Mini-PRD-Flight-Booking-Agent.md) remains the source of truth for FlightGenie's scope. Booking stays simulated throughout these experiments.

## 0. Baseline

| Capability | Original assessment | Target |
|---|---|---|
| Intent to specification | Written PRD guides the build | Add acceptance criteria per story |
| Feature generation | Faster than manual verification | Measure generation and review time separately |
| UI verification | Primarily manual | Automate checks where the result is measurable |
| Core permission and booking checks | Existing deterministic tests | Keep them in every relevant verification run |
| Build loop | Manually coordinated | Use bounded iterations with recorded results |
| Separate verifier | Not yet calibrated | Compare its findings with my own review |
| Commit and PR workflow | Manual in the original baseline | Review current tooling before adding automation |

The narrow booking checks show what an explicit acceptance test can cover. They do not establish that a model can verify the whole product.

## 1. Working hypotheses

### 1a. Persist state outside the conversation

Each iteration should read the story, current files, prior failures, and verification results. Store that evidence in files and git so a fresh context can continue the work.

A repeated prompt alone does not establish progress. Every pass needs a bounded task, a checkable result, and a stopping rule.

### 1b. Separate generation from review

Test a separate model as a reviewer against a written rubric. A second model can still share the generator's blind spots, so treat independence as a hypothesis.

Compare a smaller model from the same family with a model from another provider. Measure missed defects, review time, and cost before choosing a split.

### 1c. Match task size to verification

| Property | Suitable for a bounded loop | Requires more definition or human review |
|---|---|---|
| Scope | One component or rule | An entire booking flow |
| Completion | Named checks and acceptance criteria | A subjective "looks right" judgment |
| Evidence | Test output, types, lint, or a defined review rubric | An unsupported model verdict |
| Failure handling | Record the failure and stop at the cap | Retry without a limit |

## 2. Target loop and constraints

1. Define one story and its acceptance criteria.
2. Write the implementation plan and review rubric.
3. Build the change.
4. Run deterministic checks and a separate review.
5. Record failures and retry within the iteration cap.
6. Prepare a commit and PR when required checks pass.
7. Escalate repeated failures for human review.

The iteration cap must be explicit before a run starts. No cap has been selected yet. Keep booking checks in the verification step and log each verdict with its evidence.

## 3. Experiment plan

### Phase A: run one loop manually

Choose one existing, small story. Write real verification commands for it and run plan, build, and verify by hand.

Success criteria: 1 story has defined acceptance checks, recorded results, and a human-reviewed outcome. Subjective UI quality still needs human review.

### Phase B: calibrate a separate verifier

Compare model reviews with my own judgment on 5 to 10 stories. Record disagreements and missed defects. Those are planned sample sizes, not completed results.

Success criteria: identify the verifier's failure modes and decide whether its findings justify the added cost.

### Phase C: automate bounded iteration

Use files and git for state. Feed failures into the next attempt. Keep manual kickoff and an enforced iteration cap.

Success criteria: 1 story moves from a failed check to a reviewed passing result. A run that reaches the cap stops and reports its remaining failures.

### Phase D: connect commits and PRs

Review existing commit tooling before adding another mechanism. Automate only after the acceptance checks and verifier have been calibrated.

Success criteria: a planned batch of 3 independent stories produces 3 reviewable PRs, with failures routed to me. This is a target demonstration, not a completed outcome.

### Phase E: review the evidence

Compare converging and failed loops. Use the findings to revise story size, review criteria, and the next experiment.

## 4. Measurement plan

| Question | Measure |
|---|---|
| Are tasks defined well enough? | Share of stories with explicit acceptance checks |
| Do iterations converge? | Median iterations to pass and share reaching the cap |
| Does the reviewer miss defects? | False-pass count and disagreement with human review |
| Does the workflow save time? | Generation, verification, and human review time per story |
| Is the model split worthwhile? | Cost per reviewed passing story |
| Does automation reduce manual work? | Number of diffs requiring line-by-line review |

False passes matter most because they can turn unverified work into an accepted result. Set the acceptable threshold before delegating more authority to the loop.

## 5. Risks and open questions

| Decision | What I need to learn |
|---|---|
| Model split | Whether a different provider catches more defects than a second model from the same family |
| Rubric authorship | Whether I need to review criteria written by the generator |
| Reviewer scope | Whether proposing fixes weakens the separation between building and review |
| Runtime | Whether the existing SDK is sufficient before adding another harness |
| Visual checks | Which UI qualities support automated checks and which require human judgment |

## 6. First step

Run Phase A on one scoped story. Record the acceptance criteria, commands, results, and manual review time.

The [Week 1 write-up](LinkedIn-Week1-Show-and-Tell.md) documents the original verification gap.
