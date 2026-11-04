# aquila-react-ai — entry point for any AI agent (Copilot, Claude, Codex)

**aquila-react-ai** is an open-source framework for AI-assisted development in React projects: roles
plan → tests → implement → review, `aquila-*` commands, documentation (C4, ADR, tracks, golden files), hooks
and quality gates. Installed as a **devDependency** (`npm i -D aquila-react-ai` + `npx aquila-react-ai init`), which copies this method into the project's versioned
`.aquila/`; project knowledge lives in the project's `docs/ai/`.

## Asked to "read aquila-react-ai" / "adapt the project"

1. If `docs/ai/aquila.json` **does not exist**, or `/aquila-init` was requested → follow the
   [`aquila-init`](skills/aquila-init/SKILL.md) skill: it also prepares docs, CI, hooks and agents for the
   first plan, reusing the current state.
2. If it exists and (re)configuration was requested → [`aquila-config`](skills/aquila-config/SKILL.md) skill (re-asks the questions, offers to rerun init). Otherwise → run `npx aquila-react-ai doctor` and fix whatever shows `✗`
   ([`aquila-doctor`](skills/aquila-doctor/SKILL.md) skill).
3. From then on, the `AGENTS.md` generated at the project root is your entry point; don't read all of aquila-react-ai.

## Map (open only what you need)

- React conventions: [`core/react.md`](core/react.md) (+ [`core/react/`](core/react/) by area).
- Method: [`core/workflow.md`](core/workflow.md) (SDD→TDD, test cases) · [`core/done.md`](core/done.md)
  (done checklist) · [`core/precedence.md`](core/precedence.md) · [`core/tracks.md`](core/tracks.md) ·
  [`core/golden-files.md`](core/golden-files.md) · [`core/docs.md`](core/docs.md) ·
  [`core/tokens.md`](core/tokens.md) · [`core/style.md`](core/style.md) ·
  [`core/quality.md`](core/quality.md) (lint by level `off`/`standard`/`high`, catalog
  [`lint/rules.json`](lint/rules.json)).
- Contributing: [`core/contributing.md`](core/contributing.md) (module map, tests and short path for low-risk changes).
- Product deep audit: [`core/deep-audit.md`](core/deep-audit.md) (coverage, evidence, severity and limits).
- Roles: [`agents/`](agents/) — `aquila-plan` · `aquila-tests` · `aquila-implement` · `aquila-review`.
- Commands: [`skills/`](skills/) — `aquila-init` · `aquila-config` · `aquila-docs` · `aquila-audit` · `aquila-deep-audit` · `aquila-plan` · `aquila-execute` · `aquila-guideline` · `aquila-review` ·
  `aquila-adr` · `aquila-c4` · `aquila-test-comment` · `aquila-doctor`.
- Project config: [`schema/aquila.schema.json`](schema/aquila.schema.json) (contract for `docs/ai/aquila.json`;
  a new key read by the CLI → goes into the schema + a test).
- CLI: [`bin/aquila.mjs`](bin/aquila.mjs) — `init` · `sync` · `check [--ready]` · `doctor` · `gate <pre-commit|pre-push|ci>` · `lint [rules|matrix]` · `tokens`.

## Working on aquila-react-ai itself

- Everything that is **method** lives here; nothing from a project's domain (that stays in its `docs/ai/`).
- One home per rule: `core/` holds the rules; agents, skills and adapters only point to it.
- The CLI, hooks, CI and lint engine are the same code in aquila-ai, aquila-react-ai and aquila-next-ai; what is
  specific to this stack lives in `bin/profile.mjs`, `stacks/`, `lint/rules.json` and `core/<stack>*.md`. Keep
  stack knowledge out of the shared code, and keep `githooks/dispatcher` byte-identical across the three.
- Only `adapters/` and `bin/` know the tools (paths, formats). A tool's path changed → change it there + test.
- Tests: `node --test test/*.test.mjs` (Node ≥ 22, no dependencies; parallel; `test/helpers.mjs` is not a test); Claude plugin:
  `node --test test/plugin.test.mjs`. Changes that break projects → major + a note in [`CHANGELOG.md`](CHANGELOG.md).
- Language: code and docs in English.
