This project uses **aquila-react-ai**: the method (rules, roles, commands) is versioned in `.aquila/` (copied from the devDependency by `npx aquila-react-ai sync`; never edit it).
Project knowledge lives in `docs/ai/` (versioned).

- **Talk to the dev in the "answers" language** (end of this file; one variant, e.g. never `pt-PT` "ficheiro"
  in `pt-BR`): questions, plans, summaries. Code and docs follow the project language.
- **Before any task**: read only the needed section of the `docs/ai/CONTEXT.md` map and confirm in the real
  code (`.aquila/core/precedence.md`: code beats docs).
- **Production code**: SDD → TDD (`.aquila/core/workflow.md`): 6-section plan → stop at
  `plan approved` → failing tests → minimal code → done checklist.
- **React code**: follow `.aquila/core/react.md` for the project's React major (end of this file);
  never use newer APIs.
- **Short path**: no behavioral impact (docs, links, comments, formatting) → exception in
  `.aquila/core/workflow.md`; in doubt or runtime affected, the full flow.
- **Commands** (`/…`; Codex: read `.aquila/skills/<command>/SKILL.md`): `aquila-plan` · `aquila-execute` ·
  `aquila-guideline` · `aquila-review` · `aquila-adr` · `aquila-c4` · `aquila-test-comment` · `aquila-init` ·
  `aquila-docs` · `aquila-audit` · `aquila-deep-audit` · `aquila-config` · `aquila-doctor`. Roles: `.aquila/agents/`.
- **Track task** → `.aquila/core/tracks.md` + `docs/tracks/README.md`. **Docs**: `.aquila/core/docs.md`.
  **Patterns**: golden file of the same type (`docs/ai/golden.md`) and the folder rule in `.github/instructions/`.
- **Tokens** (`.aquila/core/tokens.md`): locate before reading. Whole-codebase tasks (`aquila-docs`, `aquila-audit`,
  `aquila-deep-audit`, `aquila-c4` from scratch) → first `npx aquila-react-ai tokens [folders]`; on `! ALERT`
  (> 20% of the dev's monthly limit) **show tokens and % and ask for approval**.
- Never `--no-verify`; commit/push only when asked (or per `workflow.autoCommit`); never declare done without green gates.
