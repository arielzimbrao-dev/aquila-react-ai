# Changelog

## 0.1.0 — 2026-11-03

- First release as the `aquila-react-ai` npm package for React projects, the frontend sibling of `aquila-ai`
  (NestJS): CLI (`npx aquila-react-ai init|sync|check|doctor|gate|lint|tokens`), skills `/aquila-*`,
  roles plan/tests/implement/review, Claude Code plugin, Copilot and Codex adapters, ESLint quality levels,
  small-PR directive (`review.prMaxFiles`, default 30, `--pr-max-files`),
  self-contained GitHub Actions workflow, `build` gate, React conventions (focus on React 18 and 19; hooks,
  state, data/forms/routing, security, accessibility, testing with Testing Library + MSW + Playwright) and
  React lint rules (`react-hooks`, `react`, `jsx-a11y`), React 19.3 notes (`<ViewTransition>`, Fragment refs,
  `browser()`, Trusted Types). `init`/`sync` refuse a `.aquila/` owned by `aquila-ai`; budgets ignore CRLF.
