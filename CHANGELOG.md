# Changelog

## 0.2.0

- Align writing rules with the user-provided `docs.md`, `aidocs.md`, and `CLAUDE.md` specifications while retaining Pi's per-folder `AGENTS.md` layout.
- Replace the human-note minimum length with an approximate 3,000-character maximum, YAML metadata, conclusion-first summaries, and concise Obsidian examples.
- Standardize agent documents on YAML metadata, four fixed Markdown sections, tagged reference data, expected-output examples, and `UNVERIFIED:` uncertainty markers.
- Add a folder registry to the writing skill, require same-topic updates and reader-specific rewrites, and preserve project-local rule precedence.
- Keep initialization and non-destructive rule update behavior unchanged; do not generate `.claude/` resources.

## 0.1.0

- Bundle one Pi extension, one documentation skill, and human/agent rule templates.
- Initialize trusted projects only after interactive approval; preserve existing rules and notes.
- Record initialization versions and SHA-256 fingerprints without machine-specific paths.
- Provide read-only status and explicit, non-destructive update previews.
- Reject unsafe symlink paths and coordinate package writers with a project-local lock.
- Cover the filesystem workflow and Pi event/command integration with isolated tests.
