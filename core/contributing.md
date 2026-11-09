# Contributing to aquila-react-ai

The CLI is the integration between project configuration and generated artifacts. Keep each rule in its
source of truth and use this map before changing code.

## Where to change

| Change | Source | Tests |
|---|---|---|
| Values, types or structure of `docs/ai/aquila.json` | `schema/aquila.schema.json` and `bin/config-validation.mjs` | `test/check-gate.test.mjs` |
| Lint catalog and levels | `lint/rules.json`, `bin/lint.mjs`, `core/quality.md` | `test/lint.test.mjs` |
| Stack detection and initial gates | `stacks/node-react.json` and `bin/stack.mjs` | `test/stacks.test.mjs` |
| Path globs (stack, docs and gates) | `bin/glob.mjs` | `test/stacks.test.mjs`, `test/check-gate.test.mjs` |
| Artifacts, routers and settings | `templates/`, `adapters/`, `bin/aquila.mjs` (`plan`, `sync`) | `test/init-sync.test.mjs` |
| Links, budgets, docs and local readiness (`check --ready`) | `bin/checks.mjs` and orchestration in `bin/aquila.mjs` | `test/check-gate.test.mjs` |
| Plugin status and enforcement matrix | `bin/lint.mjs`, `lint/eslint/build.mjs`, `lint/eslint/plugins.mjs` | `test/lint.test.mjs` |
| Product deep audit | `core/deep-audit.md`, `skills/aquila-deep-audit/` | `test/deep-audit.test.mjs` |
| Adoption, modes and tools | presets, CLI and existing adapters | `test/scenarios.test.mjs` |
| Regressions DA-001 to DA-006 (gates, CI/hooks, pnpm and invalid config preservation) | `bin/stack.mjs`, `bin/checks.mjs`, `bin/aquila.mjs` | `test/audit-regressions.test.mjs` |
| `init`, hooks and doctor | `bin/aquila.mjs` (`init`, `doctor`), `githooks/` (the shared aquila-hooks dispatcher: keep it byte-identical in aquila-ai, aquila-react-ai and aquila-next-ai) and `skills/aquila-init/SKILL.md` | `test/init-sync.test.mjs`, `test/check-gate.test.mjs`, `test/monorepo.test.mjs` |
| Gate execution and filtering | `bin/aquila.mjs` (`gate`, generated `.github/workflows/aquila-gates.yml` — `aquila-gates-<dir>.yml` at the repository root for a project in a subfolder) | `test/check-gate.test.mjs` |
| Rules for a task or checklist | `core/` | contract test if there is CLI behavior |
| Model per role/skill, `disable-model-invocation` | `adapters/models.json`, `core/models.md`, agent/skill frontmatter | `test/models.test.mjs` |
| When a skill fires (or must not) | `skills/*/SKILL.md` description, `evals/` | `claude plugin eval` (Claude Code ≥ 2.1.269; costs tokens) |

`bin/aquila.mjs` holds the CLI composition and lifecycle; validation, lint and stack detection/initial
configuration live in the modules `bin/config-validation.mjs`, `bin/lint.mjs` and `bin/stack.mjs`.
Shared globs live in `bin/glob.mjs`; the CLI's previous exports stay compatible.
Documentation checks and readiness rules live in `bin/checks.mjs`; the entrypoint wires them to the
adapters and local integrations. Plugin loading is shared by the report and the ESLint gate, so both
reflect the same configuration.
`/aquila-init` orchestrates the full setup; the CLI `init` installs only the deterministic part.
When adding a command with a separable responsibility, prefer a module in `bin/` and keep the
orchestration in the entrypoint.

## Validate

1. Add or adjust the test in the indicated file; integration tests create a temporary project and invoke
   the real CLI through `test/helpers.mjs`.
2. Run the touched test file with `node --test test/<file>.test.mjs`.
3. Before finishing, run `node --test test/*.test.mjs`, plus `node --test test/plugin.test.mjs` if the
   change touches plugin metadata or integration (CI also runs `claude plugin validate . --strict`). Changed
   a skill or agent → add or adjust its case in `evals/` and run `claude plugin eval . --case <case> --runs 1`
   (costs tokens; `evals/` is not published to npm).
4. Update the README, `core/` and `CHANGELOG.md` when the adoption experience or the contract consumed by
   projects changes. A breaking change requires a major version and a migration note.

The scenario matrix uses synthetic manifests and harmless Node gates: it verifies configuration,
preservation and CLI orchestration, not project builds or LLM behavior.
The audit tests verify the documentary contract and generated discovery; they do not guarantee an agent
finds every defect in a real project. Don't confuse these levels of evidence.
