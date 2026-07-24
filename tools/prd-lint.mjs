#!/usr/bin/env node
// prd-lint — deterministic structural gate for PRDs and specs.
//
// WHY THIS EXISTS (read before editing):
//   The `prd-interviewer` and `plan-critic` agents can *reason* about a brief,
//   but reasoning is not a guarantee — a model can be talked out of its own
//   checklist. This script is the layer that fires 100% of the time. It answers
//   exactly one question, cheaply and reproducibly: "does this document have the
//   structural bones a sign-off-ready brief must have, with no placeholders in
//   the parts that matter?" Anything requiring judgement (is the problem *real*,
//   is the success metric *the right one*) is deliberately NOT here — that's the
//   agents' job. Keep this gate high-signal: only promote a check to `error` if a
//   true document should essentially never trip it. A noisy gate gets ignored,
//   and an ignored gate is worse than no gate.
//
// USAGE:
//   node tools/prd-lint.mjs <file.md> [--profile prd|spec|auto] [--json] [--hook]
//   --profile auto (default): prd if filename contains "prd", else spec.
//   --json : machine-readable report (used by agents).
//   --hook : read a Claude Code PostToolUse hook payload on stdin, lint the
//            written file, and emit a hook JSON decision (block on errors).
//
// EXIT CODES (CLI mode): 0 = clean or warnings only · 2 = at least one error.

import { readFileSync } from "node:fs";

// ---------------------------------------------------------------------------
// Profiles: required sections are data, not code, so this stays easy to tune.
// Each "section" is a list of heading aliases (case-insensitive substring or
// regex). A section counts as present if ANY heading in the doc matches.
// ---------------------------------------------------------------------------
const SECTION_ALIASES = {
  problem:      [/problem/i, /\bwhy\b/i, /background/i, /tl;dr/i, /purpose/i, /motivation/i],
  purpose:      [/purpose/i, /overview/i, /\bgoal of this doc/i, /tl;dr/i, /summary/i],
  success:      [/success crit/i, /definition of done/i, /acceptance/i, /\bgoals?\b/i, /objectives?/i],
  dod:          [/definition of done/i, /success crit/i, /acceptance/i, /done means/i],
  scope:        [/scope/i, /in scope/i],
  nongoals:     [/non-?goals?/i, /out of scope/i, /not building/i, /won'?t (do|build)/i],
  constraints:  [/constraints?/i, /guardrails?/i, /non-negotiable/i, /assumptions/i],
  plan:         [/\bplan\b/i, /phase/i, /milestone/i, /approach/i, /roadmap/i, /topology/i],
  risks:        [/risks?/i, /open questions?/i, /trade-?offs?/i],
};

const PROFILES = {
  // Full product brief: the sign-off bar.
  prd: {
    required: ["problem", "success", "scope", "nongoals", "constraints", "plan", "risks"],
    // Sections whose body must contain a digit (quantified success bar).
    quantify: ["success"],
    // Sections where a placeholder is fatal, not just a warning.
    critical: ["problem", "success", "scope", "nongoals"],
  },
  // Technical / design spec (HLD, RFC): implements a PRD. Doesn't restate the
  // problem, but MUST declare its guardrails, its done bar, its risks, and trace
  // to a source of truth it can't silently override.
  spec: {
    required: ["purpose", "constraints", "dod", "risks"],
    quantify: ["dod"],
    critical: ["purpose", "constraints", "dod"],
    // A spec that names no source-of-truth doc is a spec that can drift.
    requireSourceOfTruth: true,
  },
  // UX / interaction / design brief: a distinct genre. It specifies BEHAVIOUR
  // and legitimately offloads the done-bar and risk register to the PRD/HLD it
  // cites. So it must still state its purpose and trace to a source of truth,
  // but a missing DoD / risks section is a warning (cite where they live), not
  // a block. Downgrading these is a classification fix, NOT a weakened gate:
  // the strict bar still applies to the docs that own those sections.
  brief: {
    required: ["purpose"],
    recommend: ["dod", "risks"],
    quantify: [],
    critical: ["purpose"],
    requireSourceOfTruth: true,
  },
};

const PLACEHOLDER = /\b(TBD|TODO|FIXME|XXX|TK)\b|\?\?\?|<placeholder>|\[fill in\]/i;
const AUDIENCE = /\b(user|users|customer|persona|segment|audience|buyer|operator)\b/i;
const SOURCE_OF_TRUTH = /source of truth|authoritative|governed by|\bPRD\b|per `[^`]+\.md`/i;

// ---------------------------------------------------------------------------
// Parse markdown into a flat list of sections keyed by heading.
// ---------------------------------------------------------------------------
function parseSections(text) {
  const lines = text.split(/\r?\n/);
  const sections = [];
  let current = { title: "(preamble)", line: 1, level: 0, body: [] };
  lines.forEach((raw, i) => {
    const m = /^(#{1,6})\s+(.*)$/.exec(raw);
    if (m) {
      sections.push(current);
      current = { title: m[2].trim(), line: i + 1, level: m[1].length, body: [] };
    } else {
      current.body.push(raw);
    }
  });
  sections.push(current);
  return sections.map((s) => ({ ...s, text: s.body.join("\n") }));
}

// A section counts as present if EITHER a heading matches an alias, OR a bold
// inline label matches one (e.g. "**Non-goals (v1):**" nested under "## Scope").
// Real PRDs routinely nest non-goals as a labeled block, not its own heading;
// requiring a heading there is a false positive that gets the gate ignored.
function sectionPresent(sections, key) {
  const aliases = SECTION_ALIASES[key] || [];
  // Prefer a real heading match — it carries a body we can scan.
  const byHeading = sections.find((s) => aliases.some((a) => a.test(s.title)));
  if (byHeading) return byHeading;
  // Fall back to a bold label anywhere in the doc.
  for (const s of sections) {
    const lines = s.text.split("\n");
    for (let i = 0; i < lines.length; i++) {
      const bold = /(?:\*\*|__)\s*([^*_]+?)\s*(?:\*\*|__)/.exec(lines[i]);
      if (bold && aliases.some((a) => a.test(bold[1]))) {
        // Return the enclosing section's body so placeholder/quantify checks
        // still have text to scan; report under the label title.
        return { ...s, title: bold[1].trim(), line: s.line + i + 1, matchedAsLabel: true };
      }
    }
  }
  return undefined;
}

function pickProfile(file, requested) {
  if (requested && requested !== "auto") return requested;
  // Match the basename only — a parent dir named e.g. "prdlint/" must not
  // decide the profile of an HLD living inside it.
  const base = String(file).split(/[\\/]/).pop() || "";
  if (/prd/i.test(base)) return "prd";
  if (/brief|\bux\b|interaction|journey/i.test(base)) return "brief";
  return "spec";
}

// ---------------------------------------------------------------------------
// The lint itself. Returns { errors, warnings, profile } as arrays of findings.
// ---------------------------------------------------------------------------
function lint(file, text, requestedProfile) {
  const profileName = pickProfile(file, requestedProfile);
  const profile = PROFILES[profileName];
  const sections = parseSections(text);
  const errors = [];
  const warnings = [];
  const add = (bucket, code, msg, line) => bucket.push({ code, msg, line: line ?? null });

  // 1. Required sections present (error) + recommended sections (warn).
  for (const key of profile.required) {
    if (!sectionPresent(sections, key)) {
      add(errors, "missing-section", `Required section missing: "${key}". A sign-off-ready ${profileName.toUpperCase()} must declare it.`);
    }
  }
  for (const key of profile.recommend || []) {
    if (!sectionPresent(sections, key)) {
      add(warnings, "missing-recommended", `No "${key}" section — fine for this genre if the doc it cites owns it, but say so explicitly.`);
    }
  }

  // 2. Placeholders — fatal inside critical sections, warning elsewhere.
  const criticalTitles = new Set(
    (profile.critical || [])
      .map((k) => sectionPresent(sections, k))
      .filter(Boolean)
      .map((s) => s.title)
  );
  for (const s of sections) {
    const lines = s.text.split("\n");
    lines.forEach((ln, idx) => {
      if (PLACEHOLDER.test(ln)) {
        const at = s.line + idx + 1;
        const where = `"${s.title}"`;
        if (criticalTitles.has(s.title)) {
          add(errors, "placeholder-critical", `Placeholder (${ln.trim().slice(0, 40)}…) in critical section ${where}. Resolve before sign-off.`, at);
        } else {
          add(warnings, "placeholder", `Placeholder in ${where} — fine to defer, but track it.`, at);
        }
      }
    });
  }

  // 3. Quantified success / DoD.
  for (const key of profile.quantify || []) {
    const sec = sectionPresent(sections, key);
    if (sec && !/\d/.test(sec.text)) {
      add(warnings, "unquantified-success", `Section "${sec.title}" has no number. "${key}" should be measurable, not adjectival — how will you know it's met?`, sec.line);
    }
  }

  // 4. Named audience somewhere in the doc.
  if (!AUDIENCE.test(text)) {
    add(warnings, "no-audience", `No user/customer/segment named anywhere. Who is this for? A brief without an audience can't have a real success bar.`);
  }

  // 5. Spec must trace to a source of truth.
  if (profile.requireSourceOfTruth && !SOURCE_OF_TRUTH.test(text)) {
    add(warnings, "no-source-of-truth", `Spec names no source-of-truth doc. A spec that can silently override its PRD will drift — cite what governs it.`);
  }

  return { file, profile: profileName, errors, warnings };
}

// ---------------------------------------------------------------------------
// Rendering.
// ---------------------------------------------------------------------------
function renderHuman({ file, profile, errors, warnings }) {
  const L = [];
  L.push(`prd-lint · ${file} · profile=${profile}`);
  const badge = errors.length ? "FAIL" : warnings.length ? "PASS (with warnings)" : "PASS";
  L.push(`  result: ${badge}  —  ${errors.length} error(s), ${warnings.length} warning(s)`);
  for (const e of errors) L.push(`  ✗ [${e.code}]${e.line ? ` L${e.line}` : ""}  ${e.msg}`);
  for (const w of warnings) L.push(`  ⚠ [${w.code}]${w.line ? ` L${w.line}` : ""}  ${w.msg}`);
  if (!errors.length && !warnings.length) L.push("  clean.");
  return L.join("\n");
}

// ---------------------------------------------------------------------------
// Entry points.
// ---------------------------------------------------------------------------
function readStdin() {
  try { return readFileSync(0, "utf8"); } catch { return ""; }
}

function main() {
  const args = process.argv.slice(2);
  const hookMode = args.includes("--hook");
  const jsonMode = args.includes("--json");
  const pIdx = args.indexOf("--profile");
  const requestedProfile = pIdx >= 0 ? args[pIdx + 1] : "auto";

  if (hookMode) {
    // Claude Code PostToolUse payload arrives on stdin. We only lint markdown
    // briefs; everything else is a silent no-op so the hook never nags.
    let payload = {};
    try { payload = JSON.parse(readStdin() || "{}"); } catch { /* ignore */ }
    const path =
      payload?.tool_input?.file_path ||
      payload?.tool_input?.path ||
      payload?.tool_response?.file_path ||
      "";
    const isBrief = /\.md$/i.test(path) && /(prd|spec|brief|hld|rfc|design-doc)/i.test(path);
    if (!isBrief) { process.exit(0); }
    let text = "";
    try { text = readFileSync(path, "utf8"); } catch { process.exit(0); }
    const report = lint(path, text, requestedProfile);
    if (report.errors.length) {
      // Exit 2 + stderr = block, per Claude Code hook contract. The agent sees
      // this text and must fix the doc before proceeding.
      console.error(`[prd-lint] blocked ${path} — ${report.errors.length} structural error(s):\n` +
        report.errors.map((e) => `  ✗ ${e.msg}`).join("\n") +
        `\nRun: node tools/prd-lint.mjs "${path}"`);
      process.exit(2);
    }
    process.exit(0);
  }

  const files = args.filter((a) => !a.startsWith("--") && a !== requestedProfile);
  if (!files.length) {
    console.error("usage: node tools/prd-lint.mjs <file.md> [--profile prd|spec|auto] [--json] [--hook]");
    process.exit(2);
  }

  const reports = files.map((f) => lint(f, readFileSync(f, "utf8"), requestedProfile));
  if (jsonMode) {
    console.log(JSON.stringify(reports.length === 1 ? reports[0] : reports, null, 2));
  } else {
    console.log(reports.map(renderHuman).join("\n\n"));
  }
  process.exit(reports.some((r) => r.errors.length) ? 2 : 0);
}

main();
