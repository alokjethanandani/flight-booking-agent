#!/usr/bin/env node
// auto-commit — commit every change in the repo with a generated message, once
// (default) or continuously as files change (--watch), after safety checks.
//
// WHY THIS EXISTS (read before editing):
//   Commits here are frequent and mostly bookkeeping (BUILD-LOG updates, content
//   drafts, small fixes). This script makes that automatic, but it refuses to
//   commit anything that looks like a secret — `.env` holds live Duffel and
//   Anthropic keys, and a leaked `duffel_live_` token is the worst-case mistake
//   in this repo. It commits locally only. It never pushes: publishing stays a
//   deliberate, separate step.
//
// HOW IT AVOIDS CLASHING WITH OTHER WORK (you, an editor, Claude, a second copy):
//   1. Single instance: a PID lockfile in .git/ stops two watchers racing.
//   2. Quiet period: a snapshot is only committed after the working tree has
//      stopped changing for --quiet seconds, so a burst of edits (a refactor, a
//      formatter, an agent writing several files) lands as one commit instead of
//      half-written fragments.
//   3. Private index: changes are staged into a temporary index file
//      (GIT_INDEX_FILE), never your real one, so your own `git add`/`commit` in
//      another terminal is never disturbed mid-operation.
//   4. Re-check before commit: if any file changed while staging, the snapshot
//      is thrown away and the quiet period restarts.
//   5. Compare-and-swap ref update: the branch only moves if it still points at
//      the commit we built on (`git update-ref <ref> <new> <old>`). If anyone
//      committed in between, ours is dropped and rebuilt next cycle, on top of
//      theirs — never overwriting it.
//   6. Back-off: while git is busy (index.lock held, merge/rebase/cherry-pick in
//      progress, detached HEAD) the watcher pauses instead of committing.
//   Status polling uses `git --no-optional-locks`, so watching never holds
//   index.lock against your own commands.
//
// USAGE:
//   npm run commit [-- options]          one-shot
//   npm run commit:watch [-- options]    watch mode
//   -m, --message : (one-shot) use this subject instead of the generated one.
//   --check       : run `npm test` and `npm run typecheck` first; skip the commit on failure.
//   --dry-run     : (one-shot) show what would be committed and the message, change nothing.
//   --watch       : keep running; commit each time the tree settles. Ctrl-C to stop.
//   --interval=N  : (watch) seconds between polls (default 2).
//   --quiet=N     : (watch) seconds the tree must be unchanged before committing (default 10).
//
// EXIT CODES: 0 = committed (or nothing to commit, or dry run) · 1 = refused/failed.

import { execFileSync, spawnSync } from "node:child_process";
import { copyFileSync, existsSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const MAX_FILE_BYTES = 5 * 1024 * 1024;

// Paths that should never be committed, even if .gitignore is edited by mistake.
const FORBIDDEN_PATHS = [/(^|\/)\.env(\..+)?$/, /\.pem$/, /\.key$/, /(^|\/)id_(rsa|ed25519)$/];
const ALLOWED_ENV_FILES = [/(^|\/)\.env\.example$/];

// Token prefixes that should never appear in an added line of the diff.
const SECRET_PATTERNS = [
  { name: "a Duffel live token", re: /duffel_live_[A-Za-z0-9_-]{8,}/ },
  { name: "a Duffel test token", re: /duffel_test_[A-Za-z0-9_-]{8,}/ },
  { name: "an Anthropic API key", re: /sk-ant-[A-Za-z0-9_-]{8,}/ },
];

class Skip extends Error {}

function log(msg) {
  const ts = new Date().toLocaleTimeString("en-GB", { hour12: false });
  console.log(`[${ts}] auto-commit: ${msg}`);
}

function fail(msg) {
  console.error(`auto-commit: ${msg}`);
  process.exit(1);
}

// Runs git with an optional private index. Throws on non-zero exit.
function git(args, { index, input } = {}) {
  const env = index ? { ...process.env, GIT_INDEX_FILE: index } : process.env;
  return execFileSync("git", ["--no-optional-locks", ...args], {
    encoding: "utf8",
    env,
    input,
    maxBuffer: 64 * 1024 * 1024,
    stdio: ["pipe", "pipe", "pipe"],
  }).trimEnd();
}

function tryGit(args, opts) {
  try {
    return { ok: true, out: git(args, opts) };
  } catch (e) {
    return { ok: false, err: (e.stderr || e.message || "").toString().trim() };
  }
}

function parseArgs(argv) {
  const opts = { message: null, check: false, dryRun: false, watch: false, interval: 2, quiet: 10 };
  const num = (a, v) => {
    const n = Number(v);
    if (!Number.isFinite(n) || n <= 0) fail(`${a} needs a positive number`);
    return n;
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "-m" || a === "--message") {
      opts.message = argv[++i];
      if (!opts.message) fail(`${a} needs a value`);
    } else if (a.startsWith("--message=")) opts.message = a.slice("--message=".length);
    else if (a === "--check") opts.check = true;
    else if (a === "--dry-run") opts.dryRun = true;
    else if (a === "--watch") opts.watch = true;
    else if (a.startsWith("--interval=")) opts.interval = num("--interval", a.split("=")[1]);
    else if (a.startsWith("--quiet=")) opts.quiet = num("--quiet", a.split("=")[1]);
    else fail(`unknown option: ${a}`);
  }
  if (opts.watch && (opts.message || opts.dryRun)) fail("--message and --dry-run only apply to one-shot mode");
  return opts;
}

// ---------------------------------------------------------------------------
// Repo state
// ---------------------------------------------------------------------------

// Returns a reason string if git is mid-operation and we should not commit.
function busyReason(gitDir) {
  if (existsSync(join(gitDir, "index.lock"))) return "another git command holds index.lock";
  for (const marker of ["MERGE_HEAD", "REBASE_HEAD", "CHERRY_PICK_HEAD", "REVERT_HEAD", "rebase-merge", "rebase-apply"]) {
    if (existsSync(join(gitDir, marker))) return `a merge/rebase/cherry-pick is in progress (${marker})`;
  }
  if (!tryGit(["symbolic-ref", "-q", "HEAD"]).ok) return "HEAD is detached; check out a branch";
  return null;
}

// A cheap signature of the working tree: git's view of what changed, plus size
// and mtime of each changed path. Equal fingerprints across polls = tree is quiet.
function fingerprint() {
  const out = git(["status", "--porcelain=v1", "-z", "--untracked-files=all"]);
  if (!out) return "";
  const entries = out.split("\0").filter(Boolean);
  const parts = [];
  for (const entry of entries) {
    const path = entry.slice(3);
    let st = "gone";
    try {
      const s = statSync(path);
      st = `${s.size}:${s.mtimeMs}`;
    } catch {}
    parts.push(`${entry}|${st}`);
  }
  return parts.join("\n");
}

// ---------------------------------------------------------------------------
// Snapshot checks + message
// ---------------------------------------------------------------------------

// Staged changes as [{ status, path, from? }], NUL-separated so odd filenames
// survive. Renames/copies carry two paths; we keep the new one as `path`.
function stagedChanges(index) {
  const parts = git(["diff", "--cached", "--name-status", "-z", "-M"], { index }).split("\0").filter(Boolean);
  const changes = [];
  for (let i = 0; i < parts.length; i++) {
    const status = parts[i];
    if (status.startsWith("R") || status.startsWith("C")) {
      changes.push({ status: status[0], from: parts[i + 1], path: parts[i + 2] });
      i += 2;
    } else {
      changes.push({ status, path: parts[i + 1] });
      i += 1;
    }
  }
  return changes;
}

function findProblems(changes, index) {
  const problems = [];
  for (const { status, path } of changes) {
    if (status === "D") continue;
    if (FORBIDDEN_PATHS.some((re) => re.test(path)) && !ALLOWED_ENV_FILES.some((re) => re.test(path))) {
      problems.push(`${path}: looks like a secrets file`);
    }
    try {
      const size = statSync(path).size;
      if (size > MAX_FILE_BYTES) {
        problems.push(`${path}: ${(size / 1024 / 1024).toFixed(1)} MB (limit ${MAX_FILE_BYTES / 1024 / 1024} MB)`);
      }
    } catch {
      // Gone since staging; the post-stage fingerprint check will catch it.
    }
  }

  let file = null;
  for (const line of git(["diff", "--cached", "--unified=0", "--no-color"], { index }).split("\n")) {
    if (line.startsWith("+++ ")) file = line.replace(/^\+\+\+ (b\/)?/, "");
    else if (line.startsWith("+")) {
      for (const { name, re } of SECRET_PATTERNS) {
        if (re.test(line)) problems.push(`${file}: added line contains ${name}`);
      }
    }
  }
  return [...new Set(problems)];
}

const STATUS_WORD = { A: "Add", M: "Update", D: "Remove", R: "Rename", C: "Copy", T: "Update" };

function area(path) {
  const parts = path.split("/");
  if (parts.length === 1) return path;
  if (parts[0] === "src" && parts.length > 2) return `${parts[0]}/${parts[1]}`;
  return parts[0];
}

function buildMessage(changes, subjectOverride) {
  const verbs = new Set(changes.map((c) => STATUS_WORD[c.status[0]] ?? "Update"));
  const verb = verbs.size === 1 ? [...verbs][0] : "Update";
  const areas = [...new Set(changes.map((c) => area(c.path)))];
  const shown = areas.slice(0, 3).join(", ") + (areas.length > 3 ? `, +${areas.length - 3} more` : "");
  const count = changes.length === 1 ? "" : ` (${changes.length} files)`;
  const subject = subjectOverride ?? `${verb} ${shown}${count}`;

  const body = changes
    .map((c) => (c.from ? `${c.status} ${c.from} -> ${c.path}` : `${c.status[0]} ${c.path}`))
    .join("\n");
  return `${subject}\n\n${body}\n`;
}

function runChecks() {
  for (const args of [["test"], ["run", "typecheck"]]) {
    log(`running npm ${args.join(" ")}...`);
    if (spawnSync("npm", args, { stdio: "inherit" }).status !== 0) {
      throw new Skip(`npm ${args.join(" ")} failed; not committing`);
    }
  }
}

// ---------------------------------------------------------------------------
// The commit itself: private index -> tree -> commit -> compare-and-swap ref.
// ---------------------------------------------------------------------------

function commitSnapshot(ctx, { message, check, dryRun, expectFingerprint }) {
  const reason = busyReason(ctx.gitDir);
  if (reason) throw new Skip(reason);

  const ref = git(["symbolic-ref", "-q", "HEAD"]);
  const head = tryGit(["rev-parse", "-q", "--verify", "HEAD"]);
  if (!head.ok) throw new Skip("branch has no commits yet; make the first commit by hand");
  const parent = head.out;

  // Seed the private index from the real one (keeps git's stat cache, so this
  // stays fast), then stage the whole working tree into it.
  // `add -A` then overwrites every entry with working-tree content, so whatever
  // you had partially staged doesn't leak into the snapshot.
  rmSync(ctx.tmpIndex, { force: true });
  try {
    if (existsSync(ctx.realIndex)) copyFileSync(ctx.realIndex, ctx.tmpIndex);
    else git(["read-tree", parent], { index: ctx.tmpIndex });
    git(["add", "-A"], { index: ctx.tmpIndex });

    const changes = stagedChanges(ctx.tmpIndex);
    if (changes.length === 0) return { committed: false, reason: "nothing to commit" };

    const problems = findProblems(changes, ctx.tmpIndex);
    if (problems.length > 0) {
      throw new Skip(`refusing to commit:\n  - ${problems.join("\n  - ")}\n  Fix these (or add them to .gitignore).`);
    }

    // Anything moved while we staged? Then this snapshot may be half-written.
    if (expectFingerprint !== undefined && fingerprint() !== expectFingerprint) {
      throw new Skip("files changed while staging; waiting for them to settle");
    }

    if (check) runChecks();

    const text = buildMessage(changes, message);
    if (dryRun) return { committed: false, dryRun: true, text };

    const tree = git(["write-tree"], { index: ctx.tmpIndex });
    const commit = git(["commit-tree", tree, "-p", parent, "-F", "-"], { input: text });

    // Only move the branch if nobody else moved it since we read `parent`.
    const swap = tryGit(["update-ref", "-m", "auto-commit", ref, commit, parent]);
    if (!swap.ok) throw new Skip("branch moved during commit (someone else committed); nothing overwritten, will rebuild on top of it");

    syncRealIndex(ctx, parent, commit);
    return { committed: true, commit, changes, branch: ref.replace("refs/heads/", ""), subject: text.split("\n")[0] };
  } finally {
    rmSync(ctx.tmpIndex, { force: true });
  }
}

// After our commit, entries in the real index that matched the old HEAD now
// look like they undo our commit. Reset only those paths to the new HEAD;
// anything you staged yourself (differing from the old HEAD) is left alone.
function syncRealIndex(ctx, oldHead, newHead) {
  const changed = git(["diff", "--name-only", "-z", oldHead, newHead]).split("\0").filter(Boolean);
  const stagedByYou = new Set(git(["diff", "--cached", "--name-only", "-z", oldHead]).split("\0").filter(Boolean));
  const paths = changed.filter((p) => !stagedByYou.has(p));
  if (paths.length === 0) return;
  const res = tryGit(["reset", "-q", newHead, "--", ...paths]);
  if (!res.ok) log(`warning: could not refresh the index (${res.err}); run \`git reset -q\` if status looks odd`);
}

// ---------------------------------------------------------------------------
// Single-instance lock (watch mode)
// ---------------------------------------------------------------------------

function acquireLock(lockPath) {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      writeFileSync(lockPath, String(process.pid), { flag: "wx" });
      return;
    } catch (e) {
      if (e.code !== "EEXIST") throw e;
      const pid = Number(readFileSync(lockPath, "utf8").trim());
      if (pid && isAlive(pid)) fail(`another watcher is already running (pid ${pid}); stop it first`);
      rmSync(lockPath, { force: true }); // stale lock from a crashed run
    }
  }
  fail(`could not take ${lockPath}`);
}

function isAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return e.code === "EPERM";
  }
}

// ---------------------------------------------------------------------------
// Modes
// ---------------------------------------------------------------------------

function oneShot(ctx, opts) {
  try {
    const res = commitSnapshot(ctx, opts);
    if (res.dryRun) {
      console.log("auto-commit: dry run, nothing committed. Message would be:\n");
      console.log(res.text.replace(/^/gm, "  "));
    } else if (!res.committed) {
      console.log(`auto-commit: ${res.reason}`);
    } else {
      console.log(`auto-commit: ${res.commit.slice(0, 7)} ${res.subject} — on ${res.branch} (not pushed)`);
    }
  } catch (e) {
    if (e instanceof Skip) fail(e.message);
    throw e;
  }
}

function watch(ctx, opts) {
  const lockPath = join(ctx.gitDir, "auto-commit.pid");
  acquireLock(lockPath);
  const release = () => rmSync(lockPath, { force: true });
  process.on("exit", release);
  for (const sig of ["SIGINT", "SIGTERM", "SIGHUP"]) {
    process.on(sig, () => {
      log("stopped");
      process.exit(0);
    });
  }

  let lastFp = null;
  let stableSince = 0;
  let lastNotice = null; // de-dupes repeated pause/refusal messages
  const notice = (msg) => {
    if (msg !== lastNotice) log(msg);
    lastNotice = msg;
  };

  log(`watching ${ctx.root} (poll ${opts.interval}s, quiet ${opts.quiet}s) — Ctrl-C to stop`);

  const tick = () => {
    try {
      const busy = busyReason(ctx.gitDir);
      if (busy) return notice(`paused: ${busy}`);

      const fp = fingerprint();
      if (!fp) {
        lastFp = fp;
        if (lastNotice !== null) notice("tree clean");
        return;
      }
      if (fp !== lastFp) {
        lastFp = fp;
        stableSince = Date.now();
        return;
      }
      if (Date.now() - stableSince < opts.quiet * 1000) return;
      if (lastNotice?.startsWith("blocked:")) return; // same refused tree; wait for it to change

      const res = commitSnapshot(ctx, { check: opts.check, expectFingerprint: fp });
      if (res.committed) {
        log(`${res.commit.slice(0, 7)} ${res.subject} — on ${res.branch}`);
        lastNotice = null;
        lastFp = null;
      }
    } catch (e) {
      if (!(e instanceof Skip)) return notice(`error: ${e.message}`);
      if (e.message.startsWith("refusing") || e.message.startsWith("npm ")) {
        log(`blocked: ${e.message}`);
        lastNotice = `blocked:${lastFp}`;
      } else {
        notice(e.message);
        lastFp = null; // restart the quiet period
      }
    }
  };

  // setTimeout chain, not setInterval: a slow cycle (--check) never overlaps the next.
  const loop = () => {
    tick();
    setTimeout(loop, opts.interval * 1000);
  };
  loop();
}

const opts = parseArgs(process.argv.slice(2));
const root = tryGit(["rev-parse", "--show-toplevel"]);
if (!root.ok) fail("not inside a git repository");
process.chdir(root.out);
const gitDir = git(["rev-parse", "--absolute-git-dir"]);
const ctx = {
  root: root.out,
  gitDir,
  realIndex: join(gitDir, "index"),
  tmpIndex: join(gitDir, `auto-commit-index.${process.pid}`),
};

if (opts.watch) watch(ctx, opts);
else oneShot(ctx, opts);
