# pi-doc-workflow

One portable Pi package for human knowledge notes (`docs/`) and evidence-based agent context (`aidocs/`). It bundles a small initialization extension, one writing skill, and two rule templates. No build step or runtime npm dependencies are required.

## Requirements

- Node.js >= 22.19.0 and Git on macOS or Linux.
- Pi with the current `@earendil-works/pi-coding-agent` extension API. Local loader smoke-tested with Pi 1.5.0; other versions have not been verified.
- Review this package before installing: Pi extensions run with the user's OS permissions.

## Install

From a local checkout, using its actual location:

```bash
pi install /path/to/pi-doc-workflow
```

Restart Pi or run `/reload`. A local installation references the checkout; keep it in place. This command changes Pi's personal package settings, not every project's settings.

For another PC, first host this Git repository yourself, commit the reviewed files, and create a release tag. Replace the account and repository placeholders below:

```bash
pi install git:github.com/YOUR_ACCOUNT/pi-doc-workflow@v0.2.0
```

Install the same tag on every PC. Tags must be treated as immutable; a commit hash gives stronger reproducibility. Install a new explicit ref to move to another release:

```bash
pi install git:github.com/YOUR_ACCOUNT/pi-doc-workflow@v0.3.0
```

That second command is an example for a future release, not a release already published. Updating a pinned Git source does not automatically advance it to a newer tag. No remote repository, release, external upload, or global installation is created by merely having this checkout.

## Project setup

When Pi opens a **trusted Git project in an interactive session**, the extension locates the Git worktree root and asks before initializing it. Starting from `src/` still targets the worktree root. A linked Git worktree has its own project root.

On approval it creates only missing files:

```text
project/
├── docs/
│   └── AGENTS.md
├── aidocs/
│   └── AGENTS.md
└── .pi-doc-workflow/
    └── state.json
```

- Existing rules and notes are preserved byte-for-byte.
- The state file records the initial package version and each rule's creation version and SHA-256 fingerprint. A preexisting rule has a `null` template version; the package does not guess its origin.
- A later trusted interactive session may restore missing rules without asking again. It never upgrades or replaces rules that already exist. Reload, resume, and fork follow the same policy.
- Declining leaves the project untouched. A future session may ask again.
- Non-Git projects are not initialized automatically. Use `/docs-init` to explicitly select the current directory, or `/docs-init /path/to/project`.
- Headless print/JSON sessions do not initialize or repair projects, even when state exists. RPC sessions may initialize only when trusted and the client answers the confirmation dialog.
- Symlinked documentation directories, rule files, or metadata paths are rejected. Root paths are canonicalized; no nested documentation symlink is followed.
- No root `AGENTS.md`, `.gitignore`, user settings, articles, or Obsidian vault configuration is generated or modified by project initialization.

The state marker carries project-level opt-in. If it is committed, another PC recognizes it only after Pi trusts that project. Do not treat a marker from an unfamiliar repository as permission to trust the repository.

## Commands

| Command | Action |
| --- | --- |
| `/docs-init [directory]` | Confirm initialization; create only missing rules and metadata. |
| `/docs-status [directory]` | Read-only report of original versions, local edits, and whether rules match installed templates. |
| `/docs-update [directory]` | Confirm staging of installed templates and display diffs; never apply them. |
| `/skill:project-docs <request>` | Explicitly load the writing workflow and process the supplied documentation request. |

For command directory arguments, enter the path itself, including spaces if necessary, without shell quoting. In a Git project the containing Git worktree root is always selected.

Example writing requests:

```text
/skill:project-docs docs/에 Galerkin 투영을 기억하기 쉽게 정리해줘.
/skill:project-docs Prepare an evidence-based solver handoff in aidocs/.
```

The extension adds a short routing instruction when an initialized project starts an agent turn. It does not load the entire document collection. The skill's folder registry maps each audience to its project-local `AGENTS.md` and bundled default rule template. It explicitly reads the selected rules, searches for an existing same-topic note before creating one, and requires rewriting content when changing the target reader. Do not assume every AI tool discovers nested instruction files automatically.

The registry follows the folder-specific rule-reading principle from the supplied `CLAUDE.md`, but this package retains Pi's `docs/AGENTS.md` and `aidocs/AGENTS.md` paths. It does not generate root `CLAUDE.md` or `.claude/rules` and `.claude/templates` files. Adding a registry row alone does not add automatic initialization for another folder; that requires a separate code change and tests.

### Human notes

Articles default to Korean with short Korean topic filenames, using English technical terms where appropriate. Start with YAML fields `title`, `created`, `updated`, and `tags`, then a title and a one-line conclusion. Define abbreviations on first use and link related notes using Obsidian `[[wikilinks]]`.

Use one idea per sentence, one point per paragraph, and one topic per section. Aim for approximately 40-50 Korean characters per sentence, about 300 at most per prose paragraph, and 3,000 at most per article. These are approximate readability targets: shorter is fine, there is no minimum, and filler is prohibited. English is used on request. Equations use Obsidian LaTeX syntax and diagrams use Mermaid, without images or ASCII art. Introduce each formula or diagram before it appears, define every formula symbol afterward, and explain diagram arrows. Use these representations only when they clarify the topic. Human articles contain no XML tags or prompt-style instructions.

### Agent documents

Documents use English only, except proper nouns, quoted user wording, and literal Korean identifiers. Use kebab-case filenames and YAML fields `title`, `created`, `updated`, `author`, `status`, and `related`; preserve `created` when updating. A requested handoff or pause of a multi-step task is a writing trigger. Assume the next agent has no current session context: completeness beats brevity.

Use exactly four top-level sections in order: `## Context`, `## Decisions`, `## Open questions`, `## Next actions`. Put long references and important source locations first in Context, using `<log>`, `<excerpt>`, and `<output_examples>` tags to distinguish reference material and examples. End with numbered next actions and their reasons. Use consistent terms and exact known values, cite inspected evidence for factual claims, and mark unchecked statements with `UNVERIFIED:`. Include concrete expected-output examples when a format is required; distinguish synthetic examples, verified findings, inferences, and proposals. Not knowing is acceptable; hiding uncertainty is not.

After writing either kind of document, report its path and a one-line summary. These defaults do not override older or customized project-local rules; use the update review below to adopt them explicitly.

These are model instructions, not a guarantee of prose quality, citation validity, length compliance, or confidentiality. Review generated documents. The package has no network calls, but normal Pi/model use may send requested text to the configured AI provider. It does not authorize uploading private content or images.

## Safe rule upgrades

1. Install the desired package release and reload Pi.
2. Run `/docs-status` to see the original version, edits since initialization, and current template matches.
3. Run `/docs-update`. It creates immutable review candidates under `.pi-doc-workflow/updates/<installed-version>/` and displays a Git diff against each current rule.
4. Review and manually merge only the desired changes into each `AGENTS.md`, after authorizing the edit. Preserve project-specific additions.
5. Run `/docs-status` again. Exact template matches are reported; historical version records intentionally remain unchanged.

There is deliberately no automatic apply command in v0.2.0. Upgrading the package is not consent to replace project policies. The metadata describes **initialization history**, not an assertion that a customized file has a particular current template version. Candidate files that were manually changed are never overwritten; retain them and resolve the conflict yourself before trying the same candidate version again.

## Version control and portability

- Keep this package's source and release tags in its own repository. `private: true` prevents accidental npm publication; Git installation remains supported.
- Track actual notes and rules in each project's repository when appropriate. Track `.pi-doc-workflow/state.json` too if you want to share its initialization history and opt-in.
- Review `aidocs/` for private data before adding it to a public repository.
- Lock directories, temporary metadata, and update candidates are local operational files. Exclude them from project version control if desired; this package never edits a project's `.gitignore` for you.
- Avoid copying `~/.pi/agent/` wholesale: it may contain credentials, sessions, and machine-specific paths.
- Generated rules are portable Markdown. The initialization extension and slash commands require Pi; other tools must explicitly read the rules or provide their own initialization integration.

## Concurrency and recovery

Initialization and staging use a project-local exclusive directory lock. A simultaneous second operation fails safely with a retry message instead of overwriting another writer. Rule and candidate creation uses exclusive creation, and metadata updates use a temporary file plus rename. This is cooperative writer protection on a local filesystem, not a defense against a malicious process replacing paths mid-operation or a guarantee for every network filesystem.

If a process crashes, partial files or `.pi-doc-workflow/.lock/` may remain. Check that no operation is running and inspect partial files first. Only after confirming that the lock is stale, remove the empty lock directory with `rmdir .pi-doc-workflow/.lock`, then run `/docs-init` again. Existing partial rules are preserved for manual review, not silently repaired. Back up edits before any manual recovery.

## Development and verification

```bash
npm test
```

Tests use Node's built-in test runner, isolated temporary directories, and mocked Pi contexts. They cover initialization, existing-file preservation, symlink rejection, state validation, update diffs, a simulated newer package release, concurrent processes, Git worktrees, trust and approval gates, and extension command behavior. No dependency installation, provider credentials, or model calls are required.

The code intentionally keeps templates in `templates/`, the portable filesystem workflow in `lib/workflow.mjs`, Pi integration in `extensions/docs-init.ts`, and authoring guidance in `skills/project-docs/SKILL.md`.

Pi package and extension references:
- https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/packages.md
- https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/extensions.md
- https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/skills.md
