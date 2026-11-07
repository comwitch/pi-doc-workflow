import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import {
  copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync,
  readdirSync, rmSync, symlinkSync, writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { test } from "node:test";
import {
  findGitRoot, initialize, prepareUpdate, readState, RULES, STATE_DIR, status, template, updateDiff, VERSION,
} from "../lib/workflow.mjs";
import extension from "../extensions/docs-init.ts";

const packageRoot = fileURLToPath(new URL("../", import.meta.url));
function temporary(t) {
  const root = mkdtempSync(join(tmpdir(), "pi-doc-workflow-test-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  return root;
}
function gitProject(t) {
  const root = temporary(t);
  execFileSync("git", ["init", "-q", root]);
  return root;
}
function mock(root, options = {}) {
  const handlers = new Map();
  const commands = new Map();
  const notifications = [];
  const prompts = [];
  const messages = [];
  const pi = {
    on: (name, handler) => handlers.set(name, handler),
    registerCommand: (name, command) => commands.set(name, command),
    sendMessage: (...args) => messages.push(args),
  };
  const ctx = {
    cwd: root,
    hasUI: options.hasUI ?? true,
    isProjectTrusted: () => options.trusted ?? true,
    ui: {
      confirm: async (...args) => { prompts.push(args); return options.approve ?? true; },
      notify: (...args) => notifications.push(args),
    },
  };
  extension(pi);
  return { handlers, commands, ctx, notifications, prompts, messages };
}

test("initialization creates exactly two rules and version metadata", (t) => {
  const root = temporary(t);
  const result = initialize(root);
  assert.deepEqual(result.created, RULES);
  for (const rule of RULES) {
    assert.equal(readFileSync(join(root, rule), "utf8"), template(rule));
    assert.equal(result.state.rules[rule].templateVersion, VERSION);
  }
  assert.equal(readState(root).initializedWith, VERSION);
  assert.deepEqual(readdirSync(root).sort(), [STATE_DIR, "aidocs", "docs"].sort());
});

test("repeated initialization preserves customized rules, notes, and metadata", (t) => {
  const root = temporary(t);
  initialize(root);
  writeFileSync(join(root, "docs/AGENTS.md"), "Custom rules\n");
  writeFileSync(join(root, "docs/note.md"), "Existing note\n");
  const state = readFileSync(join(root, STATE_DIR, "state.json"), "utf8");
  assert.deepEqual(initialize(root).created, []);
  assert.equal(readFileSync(join(root, "docs/AGENTS.md"), "utf8"), "Custom rules\n");
  assert.equal(readFileSync(join(root, "docs/note.md"), "utf8"), "Existing note\n");
  assert.equal(readFileSync(join(root, STATE_DIR, "state.json"), "utf8"), state);
  assert.equal(status(root).rules[0].modifiedSinceRecord, true);
});

test("preexisting rules are preserved and recorded as an unknown template version", (t) => {
  const root = temporary(t);
  mkdirSync(join(root, "docs"));
  writeFileSync(join(root, "docs/AGENTS.md"), "Local policy");
  initialize(root);
  assert.equal(readState(root).rules["docs/AGENTS.md"].templateVersion, null);
  assert.equal(readFileSync(join(root, "docs/AGENTS.md"), "utf8"), "Local policy");
});

test("restores a missing rule without replacing the other one", (t) => {
  const root = temporary(t);
  initialize(root);
  rmSync(join(root, "aidocs/AGENTS.md"));
  writeFileSync(join(root, "docs/AGENTS.md"), "Custom");
  assert.deepEqual(initialize(root).created, ["aidocs/AGENTS.md"]);
  assert.equal(readFileSync(join(root, "docs/AGENTS.md"), "utf8"), "Custom");
});

for (const target of ["docs", "aidocs", STATE_DIR, "docs/AGENTS.md", `${STATE_DIR}/state.json`]) {
  test(`rejects symlinked ${target} before initialization`, (t) => {
    const root = temporary(t);
    const outside = temporary(t);
    const parts = target.split("/");
    if (parts.length > 1) mkdirSync(join(root, parts[0]));
    symlinkSync(join(outside, "nonexistent"), join(root, target));
    assert.throws(() => initialize(root), /Unsafe path/);
    assert.deepEqual(readdirSync(outside), []);
    assert.equal(existsSync(join(root, "aidocs/AGENTS.md")), false);
  });
}

test("rejects directories with the wrong type and corrupt state", (t) => {
  const root = temporary(t);
  writeFileSync(join(root, "docs"), "Not a directory");
  assert.throws(() => initialize(root), /Unsafe path/);
  assert.equal(existsSync(join(root, STATE_DIR)), false);
  const other = temporary(t);
  mkdirSync(join(other, STATE_DIR));
  writeFileSync(join(other, STATE_DIR, "state.json"), '{"schemaVersion":99}');
  assert.throws(() => initialize(other), /Unsupported or invalid state/);
  assert.equal(existsSync(join(other, "docs")), false);
  assert.equal(existsSync(join(other, STATE_DIR, ".lock")), false);
});

test("status is read-only on an uninitialized project", (t) => {
  const root = temporary(t);
  assert.equal(status(root).initializedWith, null);
  assert.deepEqual(readdirSync(root), []);
});

test("update stages candidates and diffs without modifying rules or version history", (t) => {
  const root = temporary(t);
  initialize(root);
  writeFileSync(join(root, "docs/AGENTS.md"), "Custom rule\n");
  const before = readFileSync(join(root, STATE_DIR, "state.json"), "utf8");
  const candidates = prepareUpdate(root);
  assert.equal(candidates[0].differs, true);
  assert.equal(candidates[1].differs, false);
  assert.match(updateDiff(root, candidates[0].rule, candidates[0].candidate), /-Custom rule/);
  assert.equal(updateDiff(root, candidates[1].rule, candidates[1].candidate), "");
  assert.equal(readFileSync(join(root, "docs/AGENTS.md"), "utf8"), "Custom rule\n");
  assert.equal(readFileSync(join(root, STATE_DIR, "state.json"), "utf8"), before);
  assert.deepEqual(prepareUpdate(root), candidates);
});

test("refuses to overwrite a changed candidate", (t) => {
  const root = temporary(t);
  initialize(root);
  const [candidate] = prepareUpdate(root);
  writeFileSync(candidate.candidate, "Manually edited proposal");
  assert.throws(() => prepareUpdate(root), /refusing to overwrite/);
  assert.equal(readFileSync(candidate.candidate, "utf8"), "Manually edited proposal");
});

test("rejects a symlinked update directory", (t) => {
  const root = temporary(t);
  const outside = temporary(t);
  initialize(root);
  symlinkSync(outside, join(root, STATE_DIR, "updates"));
  assert.throws(() => prepareUpdate(root), /Unsafe path/);
  assert.deepEqual(readdirSync(outside), []);
});

test("a new package version does not migrate existing rules or falsify recorded versions", async (t) => {
  const root = temporary(t);
  initialize(root);
  const before = readFileSync(join(root, "docs/AGENTS.md"), "utf8");
  const release = temporary(t);
  mkdirSync(join(release, "lib"));
  mkdirSync(join(release, "templates"));
  copyFileSync(join(packageRoot, "lib/workflow.mjs"), join(release, "lib/workflow.mjs"));
  writeFileSync(join(release, "package.json"), JSON.stringify({ version: "0.2.0" }));
  for (const rule of RULES) {
    writeFileSync(join(release, "templates", `${rule.split("/")[0]}-AGENTS.md`), "New version rules\n");
  }
  const next = await import(pathToFileURL(join(release, "lib/workflow.mjs")));
  assert.deepEqual(next.initialize(root).created, []);
  assert.equal(readFileSync(join(root, "docs/AGENTS.md"), "utf8"), before);
  const candidates = next.prepareUpdate(root);
  assert.match(candidates[0].candidate, /0\.2\.0/);
  assert.equal(readState(root).rules["docs/AGENTS.md"].templateVersion, VERSION);
  assert.equal(next.status(root).rules[0].matchesInstalledTemplate, false);
});

test("a held lock fails safely and is not removed by another writer", (t) => {
  const root = temporary(t);
  mkdirSync(join(root, STATE_DIR));
  mkdirSync(join(root, STATE_DIR, ".lock"));
  assert.throws(() => initialize(root), /Another operation holds/);
  assert.equal(existsSync(join(root, STATE_DIR, ".lock")), true);
  assert.equal(existsSync(join(root, "docs")), false);
});

test("concurrent processes never clobber rules or corrupt metadata", async (t) => {
  const root = temporary(t);
  const module = pathToFileURL(join(packageRoot, "lib/workflow.mjs")).href;
  const source = `import { initialize } from ${JSON.stringify(module)}; try { initialize(${JSON.stringify(root)}); } catch (e) { if (!e.message.includes('Another operation holds')) throw e; }`;
  const runs = Array.from({ length: 4 }, () => new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ["--input-type=module", "-e", source], { stdio: ["ignore", "pipe", "pipe"] });
    let errors = "";
    child.stderr.on("data", (data) => { errors += data; });
    child.on("error", reject);
    child.on("close", (code) => code === 0 ? resolve() : reject(new Error(errors)));
  }));
  await Promise.all(runs);
  assert.equal(readState(root).schemaVersion, 1);
  for (const rule of RULES) assert.equal(readFileSync(join(root, rule), "utf8"), template(rule));
});

test("Git root discovery works from a subdirectory and a linked worktree", (t) => {
  const root = gitProject(t);
  mkdirSync(join(root, "src"));
  assert.equal(findGitRoot(join(root, "src")), root);
  assert.equal(findGitRoot(temporary(t)), undefined);
  execFileSync("git", ["-C", root, "-c", "user.name=Test", "-c", "user.email=test@example.invalid", "commit", "--allow-empty", "-qm", "Initial test commit"]);
  const worktree = join(temporary(t), "worktree");
  execFileSync("git", ["-C", root, "worktree", "add", "-qb", "test-worktree", worktree]);
  assert.equal(findGitRoot(worktree), worktree);
});

for (const options of [{ hasUI: false }, { trusted: false }, { approve: false }]) {
  test(`startup does not write without UI, trust, and approval: ${JSON.stringify(options)}`, async (t) => {
    const root = gitProject(t);
    const m = mock(root, options);
    await m.handlers.get("session_start")({ reason: "startup" }, m.ctx);
    assert.equal(existsSync(join(root, STATE_DIR)), false);
    assert.equal(existsSync(join(root, "docs")), false);
  });
}

test("non-Git projects require the explicit init command", async (t) => {
  const root = temporary(t);
  const m = mock(root);
  await m.handlers.get("session_start")({}, m.ctx);
  assert.deepEqual(readdirSync(root), []);
  await m.commands.get("docs-init").handler("", m.ctx);
  assert.equal(existsSync(join(root, "docs/AGENTS.md")), true);
  assert.equal(m.prompts.length, 1);
});

test("approved startup initializes once and reload preserves local edits without another prompt", async (t) => {
  const root = gitProject(t);
  const m = mock(root);
  await m.handlers.get("session_start")({ reason: "startup" }, m.ctx);
  writeFileSync(join(root, "docs/AGENTS.md"), "Local edits");
  await m.handlers.get("session_start")({ reason: "reload" }, m.ctx);
  assert.equal(m.prompts.length, 1);
  assert.equal(readFileSync(join(root, "docs/AGENTS.md"), "utf8"), "Local edits");
  const event = { systemPromptOptions: { sections: {} } };
  m.handlers.get("before_agent_start")(event, m.ctx);
  assert.match(event.systemPromptOptions.sections.project_documentation, /explicitly read/);
  assert.doesNotMatch(event.systemPromptOptions.sections.project_documentation, /Local edits/);
});

test("update command emits a diff without triggering an agent turn", async (t) => {
  const root = gitProject(t);
  initialize(root);
  writeFileSync(join(root, "aidocs/AGENTS.md"), "Custom agent rules\n");
  const m = mock(root);
  await m.commands.get("docs-update").handler("", m.ctx);
  assert.equal(m.messages.length, 1);
  assert.match(m.messages[0][0].content, /-Custom agent rules/);
  assert.deepEqual(m.messages[0][1], { triggerTurn: false });
  assert.equal(readFileSync(join(root, "aidocs/AGENTS.md"), "utf8"), "Custom agent rules\n");
});

test("manifest and skill resources are portable and present", () => {
  const manifest = JSON.parse(readFileSync(join(packageRoot, "package.json"), "utf8"));
  assert.deepEqual(manifest.pi.extensions, ["./extensions/docs-init.ts"]);
  const skill = readFileSync(join(packageRoot, "skills/project-docs/SKILL.md"), "utf8");
  assert.match(skill, /^---\nname: project-docs\ndescription:/);
  assert.equal(skill.includes("/home/"), false);
  assert.equal(template(RULES[0]).includes("1,500"), true);
  assert.equal(template(RULES[1]).includes("Not knowing is acceptable"), true);
});
