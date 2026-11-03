# Changelog

## 0.2.0 — 2026-11-03

Monorepo and sibling packages: the project no longer has to be the root of the git repository, and
`aquila-ai`, `aquila-react-ai` and `aquila-next-ai` can live in one repository (e.g. `repo/backend` +
`repo/frontend`).

- **Git hooks:** a shared dispatcher at the repository root (`.aquila-hooks/pre-commit|pre-push`,
  `core.hooksPath = .aquila-hooks`), byte-identical in the three packages. Each `init`/`sync` registers its
  project in `.aquila-hooks/projects` (`<package> <dir>`) and keeps the other packages' lines; the hook runs
  `gate <phase>` only in projects with changed files, using the CLI installed in that folder (or hoisted).
  Fixes hooks that failed in a subfolder (`node_modules` looked up at the root) and the second package that
  could not set `core.hooksPath`. `sync` migrates a 0.1.0 `core.hooksPath` (`.aquila/githooks`,
  `node_modules/aquila-react-ai/githooks`); `.aquila/githooks/` is no longer copied.
- **CI:** in a subfolder the workflow is written at the root as `.github/workflows/aquila-gates-<dir>.yml`, with
  `working-directory` and `paths` filters; `sync` removes a generated workflow left inside the subfolder.
- **`gate ci`:** changed files are compared with `git diff --relative`, so `when` globs (`src/**`) match in a
  subfolder.
- **Local mode:** `.git/info/exclude` entries are prefixed with the project folder.
- **`check` / `doctor`:** `check` fails on a hooksPath git resolves to nothing, a missing dispatcher, a project
  not registered and a workflow inside a subfolder; `doctor` shows the subfolder, the dispatcher, whether the
  hook finds the CLI, the workflow location and the aquila projects in the repository.
- README: "Monorepo / project in a subfolder" and "Sibling packages" sections.

## 0.1.0 — 2026-11-03

- First release as the `aquila-react-ai` npm package for React projects, the frontend sibling of `aquila-ai`
  (NestJS): CLI (`npx aquila-react-ai init|sync|check|doctor|gate|lint|tokens`), skills `/aquila-*`,
  roles plan/tests/implement/review, Claude Code plugin, Copilot and Codex adapters, ESLint quality levels,
  small-PR directive (`review.prMaxFiles`, default 30, `--pr-max-files`),
  self-contained GitHub Actions workflow, `build` gate, React conventions (focus on React 18 and 19; hooks,
  state, data/forms/routing, security, accessibility, testing with Testing Library + MSW + Playwright) and
  React lint rules (`react-hooks`, `react`, `jsx-a11y`), React 19.3 notes (`<ViewTransition>`, Fragment refs,
  `browser()`, Trusted Types). `init`/`sync` refuse a `.aquila/` owned by `aquila-ai`; budgets ignore CRLF.
