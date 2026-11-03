# Code quality (lint)

Single catalog: [`../lint/rules.json`](../lint/rules.json). Each rule is a principle + the equivalent
Sonar rule (a reference anchor) + its local ESLint enforcement when one exists.

## Levels (`docs/ai/aquila.json` → `lint.level`)

- **`off`** — no aquila-react-ai lint gate and no rules in the agents' context. The project's own lint (if any)
  stays in `gates`.
- **`standard`** (default) — basic, low-noise rules: types, promises, dead code, logger, strict equality,
  nested ternaries, cognitive complexity ≤ 15, env only in the config module, Rules of Hooks and complete
  dependency arrays, list keys, no `dangerouslySetInnerHTML`, accessibility basics, tests with asserts and
  no `only`/`skip`.
- **`high`** — `standard` + no index keys, no nested component definitions, immutability, modern APIs,
  SonarJS profile, functions/components ≤ 80 lines / ≤ 5 parameters / nesting ≤ 3, test titles, specific
  asserts.

## How it enters the work

- **AI writing code**: the generated `AGENTS.md` states the level; the rules in compact text come from
  `npx aquila-react-ai lint rules` (only those of the level). `aquila-implement` writes compliant code from the
  start.
- **Quality analysis**: `aquila-review` checks the diff against the level's rules, including those marked
  "(review)" (Sonar only, no local rule).
- **Gate**: `npx aquila-react-ai lint` (gate `lint-aquila` in pre-push and CI) runs ESLint with
  [`../lint/eslint/eslint.config.mjs`](../lint/eslint/eslint.config.mjs); the plugins are the project's
  (`typescript-eslint`, `eslint-plugin-react-hooks`, `eslint-plugin-react`, `eslint-plugin-jsx-a11y`,
  `eslint-plugin-sonarjs`, `eslint-plugin-unicorn`, `eslint-plugin-jest` — its rules also fit Vitest's
  `describe`/`it`/`expect`) — rules from missing plugins are skipped with a warning.

## Per-project options (`lint.options`)

- `configPaths` — where `process.env` / `import.meta.env` may be read (default `**/config/**`,
  `**/env.*`, `**/*.config.*`).
- `ticketPattern` — regex of ticket ids forbidden in test titles (e.g. `JIRA-\\d+`); without it only
  "should" is forbidden.
- `aliases` — aquila-react-ai rules the project already has under another name, `{ "<project rule>": "<aquila-react-ai
  rule>" }` (e.g. `{ "local/max-params": "aquila/max-params" }`). The aquila-react-ai rule runs under the
  project's name, so existing `eslint-disable local/max-params` comments also cover it (without an alias
  they give "Definition for rule … was not found"). Do not migrate the disables to `aquila/…`: the
  project's own lint doesn't know that plugin and would raise the same error.
- Stories (`**/*.stories.*`) are excluded from the function-size rules.
- ESLint runs with a cache in `node_modules/.cache/aquila-eslint`.

## Catalog capability vs. effective enforcement

| Engine | What CI can block | What still requires review |
|---|---|---|
| ESLint | Core/local rules and those of loaded plugins; typed rules depend on the project's parser and tsconfig | Principles without a mapping, unanalyzed scopes and missing plugins |

The detailed matrix is generated from the single source, without keeping a second rule list:

```bash
npx aquila-react-ai lint matrix --level=high
```

This shows **capability**, not execution. For this machine's configuration, run `lint rules`: it loads
the same plugins and uses the same builder as the gate to distinguish rules that are **configured**,
**partial** and **without an active rule** due to a missing dependency. An installed plugin that fails to
load gives an explicit error; it is not treated as absent. `doctor` only confirms availability and points
to these reports.

A configured rule does not prove the files were analyzed nor full parity with Sonar: only running
`lint`/`gate ci` shows the result. The catalog describes principles; the mappings are concrete checks,
sometimes partial. Test plugins also depend on the test framework and configured scope. aquila-react-ai does not
check Sonar's remote quality gate here.

## Domain rules

Project-specific rules (layer direction, log event grammar, reserved names) belong in the project's own
lint and in `.github/instructions/`, not in the catalog.

## Adding a rule

An entry in `lint/rules.json` (`id`, `level`, `sonar`, `title`, `why`, `enforce.eslint`) + test; the
`high` level is never more permissive than `standard`. Changing a rule's level is visible to projects →
note in the [`CHANGELOG`](../CHANGELOG.md).
