This project uses **aquila-react-ai**: the method (rules, roles, commands) is versioned in `.aquila/` (copied from the devDependency by `npx aquila-react-ai sync`; never edit it).
Project knowledge lives in `docs/ai/` (versioned).

- **Talk to the dev in the "answers" language** (end of this file; never mix variants, e.g. `pt-PT`
  "ficheiro", "ecrã" vs `pt-BR` "arquivo", "tela"): questions, plans, summaries and reports. Code and docs
  follow the project language (also at the end of this file).
- **Before any task**: read only the needed section of the `docs/ai/CONTEXT.md` map and confirm in the real
  code (`.aquila/core/precedence.md`: code beats docs).
- **Production code**: SDD → TDD (`.aquila/core/workflow.md`): 6-section plan → stop at
  `plan approved` → failing tests → minimal code → done checklist.
- **React code**: follow `.aquila/core/react.md` for the project's React major (end of this
  file) and framework; never use APIs newer than those versions.
- **Short path**: changes with no behavioral impact (docs, links, comments, formatting) follow the
  exception in `.aquila/core/workflow.md`; if in doubt or runtime is affected, use the full
  flow.
- **Commands**: `aquila-plan` · `aquila-execute` · `aquila-guideline` (tracks) · `aquila-review` · `aquila-adr` ·
  `aquila-c4` · `aquila-test-comment` · project: `aquila-init` (includes docs and validation) · `aquila-docs` · `aquila-audit` · `aquila-deep-audit` · `aquila-config` · `aquila-doctor`
  (`/aquila-…`; in Codex read and follow `.aquila/skills/<command>/SKILL.md`). Roles: `.aquila/agents/`.
- **Track task** → `.aquila/core/tracks.md` + `docs/tracks/README.md`. **Docs**:
  `.aquila/core/docs.md`. **Patterns**: golden file of the same type (`docs/ai/golden.md`) and the
  folder rule in `.github/instructions/`.
- **Tokens** (`.aquila/core/tokens.md`): locate before reading. Tasks that read the whole codebase (`aquila-docs`,
  `aquila-audit`, `aquila-deep-audit`, `aquila-c4` from scratch, "analyze the repo") → first `npx aquila-react-ai tokens [folders]`;
  on `! ALERT` (> 20% of the dev's monthly limit) **show the tokens and % and ask for approval**.
- Never `--no-verify`; commit/push only when asked; never declare done without green gates.
