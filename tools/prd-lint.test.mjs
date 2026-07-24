#!/usr/bin/env node
// Regression tests for prd-lint. The gate is only trustworthy if it catches
// planted flaws AND leaves a good doc alone (low false-positive rate — a noisy
// gate gets ignored). Run: node tools/prd-lint.test.mjs
import { execFileSync } from "node:child_process";
import { writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const LINT = new URL("./prd-lint.mjs", import.meta.url).pathname;
const dir = mkdtempSync(join(tmpdir(), "prdlint-"));
let pass = 0, fail = 0;

function run(name, file) {
  const path = join(dir, name);
  writeFileSync(path, file);
  try {
    const out = execFileSync("node", [LINT, path, "--json"], { encoding: "utf8" });
    return { code: 0, report: JSON.parse(out) };
  } catch (e) {
    return { code: e.status, report: JSON.parse(e.stdout) };
  }
}
function check(desc, cond) {
  if (cond) { pass++; console.log(`  ✓ ${desc}`); }
  else { fail++; console.log(`  ✗ ${desc}`); }
}

// A well-formed PRD should PASS with no errors.
const goodPrd = `# Widget-PRD
## 1. Problem
Users of segment X waste 20 minutes per task.
## 2. Success criteria
Cut task time to under 5 minutes for 80% of users.
## 3. Scope
In scope: the core flow.
### Non-goals
Not building: mobile, offline.
## 4. Constraints & guardrails
No PII leaves the device.
## 5. Plan
Phase 0 → 1 → 2.
## 6. Risks
Adoption risk; mitigate with onboarding.`;
let r = run("good-prd.md", goodPrd);
check("good PRD → exit 0", r.code === 0);
check("good PRD → zero errors", r.report.errors.length === 0);
check("good PRD → auto-selected prd profile", r.report.profile === "prd");

// Missing non-goals → error.
const noNonGoals = goodPrd.replace("### Non-goals\nNot building: mobile, offline.", "");
r = run("no-nongoals-prd.md", noNonGoals);
check("missing non-goals → exit 2", r.code === 2);
check("missing non-goals → flagged", r.report.errors.some((e) => e.code === "missing-section"));

// Placeholder in a critical section → error.
const placeholder = goodPrd.replace("Cut task time to under 5 minutes for 80% of users.", "TBD");
r = run("placeholder-prd.md", placeholder);
check("placeholder in success → exit 2", r.code === 2);
check("placeholder in success → flagged critical", r.report.errors.some((e) => e.code === "placeholder-critical"));

// Unquantified success → warning, not error.
const noNumbers = goodPrd.replace("Cut task time to under 5 minutes for 80% of users.", "Make it much faster and better.");
r = run("unquantified-prd.md", noNumbers);
check("unquantified success → still exit 0", r.code === 0);
check("unquantified success → warned", r.report.warnings.some((w) => w.code === "unquantified-success"));

// Spec profile: a doc named HLD with no DoD → error under spec profile.
const specNoDod = `# HLD-Thing
## Purpose
Implements the Widget-PRD (source of truth).
## Constraints
Read-only core; no new deps.
## Risks
Latency.`;
r = run("HLD-thing.md", specNoDod);
check("HLD auto-selects spec profile", r.report.profile === "spec");
check("spec missing DoD → exit 2", r.code === 2 && r.report.errors.some((e) => e.code === "missing-section"));

// Non-goals as a bold label nested under Scope (how real PRDs write it) → present.
const nestedNonGoals = `# Widget-PRD
## 1. Problem
Segment X wastes 20 min/task.
## 2. Success criteria
Under 5 min for 80% of users.
## 3. Scope
**In scope (v1):** the core flow.
**Non-goals (v1):** no mobile, no offline.
## 4. Constraints & guardrails
No PII off-device.
## 5. Plan
Phase 0 -> 1.
## 6. Risks
Adoption.`;
r = run("nested-nongoals-prd.md", nestedNonGoals);
check("non-goals as bold label under Scope → not flagged missing", !r.report.errors.some((e) => e.code === "missing-section"));
check("non-goals as bold label → exit 0", r.code === 0);

console.log(`\nprd-lint: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
