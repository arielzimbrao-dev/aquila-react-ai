---
name: aquila-config
description: >-
  Re-asks the aquila-react-ai configuration questions (language, tools, token limit, mode, lint, coverage, QA, CI…) over the existing docs/ai/aquila.json, applies them with sync and offers to rerun init. Use for "change the lint", "switch to team", "reconfigure", "/aquila-config".
model: sonnet
disable-model-invocation: true
---

# aquila-config — change the configuration

Precondition: `docs/ai/aquila.json` exists (otherwise → [`aquila-init`](../aquila-init/SKILL.md)). With
`$ARGUMENTS` (e.g. `lint`, `mode`) ask only that; otherwise, everything. Does not read code: only
`aquila.json` and the schema.

## 1. Ask

Questions come from the [`schema/aquila.schema.json`](../../schema/aquila.schema.json) contract — a new
key in the schema is a new question here — plus the token limit from `docs/ai/aquila.local.json`. Show
the **current value** of each as the suggestion ("keep" = unchanged). Same order as
[`aquila-init`](../aquila-init/SKILL.md): the six essential choices in a single question, with the
practical effect of each and the current values.

- **Essential**, in this order: language (`language.docs` and `language.answers`: `en` | `pt-BR` |
  `pt-PT` — applies to the conversation and all documentation; `language.code` only if the dev wants to
  change it) · `tools` (claude, codex, copilot) · monthly token limit (number or none, which disables
  the alert; [`core/tokens.md`](../../core/tokens.md)) · `mode` (`local` | `team` — team commits the
  routers; use with cloud agents or AI PR review) · `lint.level` (`off` | `standard` | `high`,
  [`core/quality.md`](../../core/quality.md)) · `review.prMaxFiles` (max files per PR, default 30;
  [`core/workflow.md`](../../core/workflow.md) §5).
- **Optional** (grouped, one line each): `coverage` (thresholds and `enforced`), `qa`, `ci` (versions,
  `install-command`, `cache`), `lint.options`, `srcDirs`/`testDirs`, `gates`/`hooks`, `budgets`,
  `review.contextSections`.

Do not ask about `version`, `project`, `stack`, `$schema` or `lint.engine`/`lint.pending` (detected).

## 2. Apply

1. Show what changes (`key: before → after`) and write **only those keys** to `docs/ai/aquila.json`; the
   token limit goes to `docs/ai/aquila.local.json` (`{ "tokenLimit": <n> | null }`, outside git).
2. `npx aquila-react-ai sync` — regenerates the adapters and the CI workflow and adds/removes the
   `lint-aquila` gate per `lint.level` (if ESLint is not installed it stays in `lint.pending`, with the
   install command).
3. `npx aquila-react-ai check` until green.
4. Tell the dev the consequences and follow [`README.md` § Local vs team mode](https://github.com/arielzimbrao-dev/aquila-react-ai#local-vs-team-mode):
   `team` → review and commit routers/settings; `local` → local exclusions do not remove already
   committed files from the Git index (team decision, never automatic); tool disabled → only the
   generated adapters are removed, the team's own content is preserved.

## 3. Rerun init?

Ask whether to run the CLI init again (restores missing `docs/` templates and git hooks via
`core.hooksPath`). If yes, run the **CLI** with the new values — without re-asking:

```bash
npx aquila-react-ai init --lang=<…> --tools=<…> --token-limit=<n|none> --mode=<…> --lint=<…> --pr-max-files=<n>
```

Close: what changed, the `check` result and what to commit (`docs/ai/aquila.json` + what `sync` listed).
If contextualized docs or integrations are missing, follow `/aquila-init` to complete the setup;
do not describe the CLI's template copy as finished documentation.
