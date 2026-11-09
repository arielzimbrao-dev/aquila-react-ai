# Done checklist

Single copy. The **concrete commands** for each item live in the project's `docs/ai/aquila.json` (`gates`);
`npx aquila-react-ai gate ci` runs those selected in `hooks.ci` (all by default) and prints only failures and
totals. The checklist in `AGENTS.md` lists `done.gates` when set (otherwise `hooks.ci`): a gate that runs only
locally, or only in the project's own CI, is still a done criterion.

- [ ] `typecheck`
- [ ] `test` — unit tests, all green
- [ ] `lint` — zero warnings (project lint + `lint-aquila` at the `lint.level` level; see
      [quality](quality.md))
- [ ] `format` — formatting checked
- [ ] `coverage` — the project command enforces the thresholds; the numbers in `docs/ai/aquila.json` →
      `coverage` document the contract (they appear in `AGENTS.md`) and are not enforced by aquila-react-ai;
      `coverage.enforced` says whether the project tool fails below them (jest `coverageThreshold`). Only
      real asserts count.
      Having a coverage gate does not prove equivalence with `test`: keep both, unless the team explicitly
      confirms they run the same tests and checks.
- [ ] `build` — production build green (catches what dev mode and tests don't: env, imports, SSR)
- [ ] `e2e` — evaluate when what connects the pieces changes: routes, providers, auth, API wiring. A
      `gates.e2e.when` glob list filters CI execution by changed paths; local hooks do not apply the filter.
- [ ] `npx aquila-react-ai check` — if docs changed: links, budgets, instructions, adapters
- [ ] generated docs regenerated and versioned (CI compares them)
- [ ] API types and mock handlers (MSW, fixtures, Storybook) in sync with the backend contract — if it changed
- [ ] `docs/c4/` updated — if files changed layer, a route/screen was born or an integration changed ([docs](docs.md))

Never declare done without all applicable items green. Never `--no-verify`.

## A red gate that is not the task's

- **It already failed before:** confirm it on the base branch, without your change. Don't fix it out of scope
  nor turn it off: report the gate, the command and the error to the dev, and check the others.
- **Flaky** (passes on retry): at most two retries; report it as flaky, with the test.
- **Missing tool, credential or service:** say so and what is needed; that item stays unverified.

In every case the task closes as **"to verify: …"**, never as done.
