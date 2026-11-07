import { createHash, randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import {
  existsSync, lstatSync, mkdirSync, readFileSync, realpathSync,
  renameSync, rmdirSync, unlinkSync, writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = fileURLToPath(new URL("../", import.meta.url));
export const VERSION = JSON.parse(readFileSync(join(packageRoot, "package.json"), "utf8")).version;
export const STATE_DIR = ".pi-doc-workflow";
export const RULES = ["docs/AGENTS.md", "aidocs/AGENTS.md"];
const hash = (text) => createHash("sha256").update(text).digest("hex");

function stat(path) {
  try {
    return lstatSync(path);
  } catch (error) {
    if (error.code === "ENOENT") return undefined;
    throw error;
  }
}

function checkPath(path, directory = false) {
  const info = stat(path);
  if (info && (info.isSymbolicLink() || !(directory ? info.isDirectory() : info.isFile()))) {
    throw new Error(`Unsafe path (symlink or wrong file type): ${path}`);
  }
  return info;
}

function ensureDirectory(path) {
  if (checkPath(path, true)) return;
  try {
    mkdirSync(path);
  } catch (error) {
    if (error.code !== "EEXIST") throw error;
    checkPath(path, true);
  }
}

export function template(rule) {
  if (!RULES.includes(rule)) throw new Error(`Unknown rule: ${rule}`);
  return readFileSync(join(packageRoot, "templates", `${rule.split("/")[0]}-AGENTS.md`), "utf8");
}

export function findGitRoot(cwd) {
  try {
    const root = execFileSync("git", ["-C", cwd, "rev-parse", "--show-toplevel"], {
      encoding: "utf8", timeout: 5000, stdio: ["ignore", "pipe", "pipe"],
    }).trim();
    return realpathSync(root);
  } catch {
    return undefined;
  }
}

function preflight(root) {
  checkPath(root, true);
  if (!existsSync(root)) throw new Error(`Project does not exist: ${root}`);
  for (const dir of ["docs", "aidocs", STATE_DIR]) checkPath(join(root, dir), true);
  for (const rule of RULES) checkPath(join(root, rule));
  checkPath(join(root, STATE_DIR, "state.json"));
}

export function readState(root) {
  preflight(root);
  const path = join(root, STATE_DIR, "state.json");
  if (!stat(path)) return undefined;
  const state = JSON.parse(readFileSync(path, "utf8"));
  if (!state || state.schemaVersion !== 1 || typeof state.initializedWith !== "string" ||
      !state.rules || typeof state.rules !== "object" || Array.isArray(state.rules)) {
    throw new Error(`Unsupported or invalid state: ${path}`);
  }
  for (const rule of RULES) {
    const entry = state.rules[rule];
    if (entry && ((entry.templateVersion !== null && typeof entry.templateVersion !== "string") ||
        typeof entry.sha256 !== "string" || !/^[a-f0-9]{64}$/.test(entry.sha256))) {
      throw new Error(`Invalid rule record: ${rule}`);
    }
  }
  return state;
}

function withLock(root, action) {
  preflight(root);
  ensureDirectory(join(root, STATE_DIR));
  const lock = join(root, STATE_DIR, ".lock");
  try {
    mkdirSync(lock);
  } catch (error) {
    if (error.code === "EEXIST") throw new Error(`Another operation holds ${lock}. Retry later; see README for crash recovery.`);
    throw error;
  }
  try {
    return action();
  } finally {
    rmdirSync(lock);
  }
}

function saveState(root, state) {
  const directory = join(root, STATE_DIR);
  const temporary = join(directory, `.state-${randomUUID()}.tmp`);
  try {
    writeFileSync(temporary, `${JSON.stringify(state, null, 2)}\n`, { flag: "wx" });
    renameSync(temporary, join(directory, "state.json"));
  } finally {
    if (stat(temporary)) unlinkSync(temporary);
  }
}

export function initialize(root) {
  return withLock(root, () => {
    const state = readState(root) ?? { schemaVersion: 1, initializedWith: VERSION, rules: {} };
    const created = [];
    const preserved = [];
    let changed = false;
    for (const rule of RULES) {
      ensureDirectory(dirname(join(root, rule)));
      const content = template(rule);
      let isNew = false;
      try {
        writeFileSync(join(root, rule), content, { flag: "wx" });
        isNew = true;
        created.push(rule);
      } catch (error) {
        if (error.code !== "EEXIST") throw error;
        checkPath(join(root, rule));
        preserved.push(rule);
      }
      if (isNew || !state.rules[rule]) {
        state.rules[rule] = {
          templateVersion: isNew ? VERSION : null,
          sha256: hash(readFileSync(join(root, rule))),
        };
        changed = true;
      }
    }
    if (changed) saveState(root, state);
    return { created, preserved, state };
  });
}

export function status(root) {
  const state = readState(root);
  return {
    root,
    packageVersion: VERSION,
    initializedWith: state?.initializedWith ?? null,
    rules: RULES.map((rule) => {
      const current = stat(join(root, rule)) ? readFileSync(join(root, rule)) : undefined;
      const recorded = state?.rules[rule];
      return {
        path: rule,
        exists: current !== undefined,
        recordedVersion: recorded?.templateVersion ?? null,
        modifiedSinceRecord: current !== undefined && recorded !== undefined && hash(current) !== recorded.sha256,
        matchesInstalledTemplate: current !== undefined && hash(current) === hash(template(rule)),
      };
    }),
  };
}

export function prepareUpdate(root) {
  return withLock(root, () => {
    if (!readState(root)) throw new Error("Initialize this project with /docs-init first.");
    const updates = join(root, STATE_DIR, "updates");
    ensureDirectory(updates);
    const directory = join(updates, VERSION);
    ensureDirectory(directory);
    return RULES.map((rule) => {
      const candidate = join(directory, `${rule.split("/")[0]}-AGENTS.md`);
      const content = template(rule);
      if (checkPath(candidate)) {
        if (readFileSync(candidate, "utf8") !== content) {
          throw new Error(`Existing candidate differs; refusing to overwrite: ${candidate}`);
        }
      } else {
        writeFileSync(candidate, content, { flag: "wx" });
      }
      return { rule, candidate, differs: !stat(join(root, rule)) || readFileSync(join(root, rule), "utf8") !== content };
    });
  });
}

export function updateDiff(root, rule, candidate) {
  const current = stat(join(root, rule)) ? join(root, rule) : "/dev/null";
  try {
    return execFileSync("git", ["--no-pager", "diff", "--no-index", "--no-ext-diff", "--no-textconv", "--text", current, candidate], {
      encoding: "utf8", timeout: 5000, maxBuffer: 64 * 1024, stdio: ["ignore", "pipe", "pipe"],
    });
  } catch (error) {
    if (error.status === 1 && typeof error.stdout === "string") return error.stdout;
    throw error;
  }
}
