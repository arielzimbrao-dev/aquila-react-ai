# Mandatory flow: SDD → TDD

Every task that changes production code follows these phases, in this order. Each phase has a role in
[`../agents/`](../agents/) and an `aquila-*` command.

## Short path — changes with no behavioral impact

For text/link/documentation fixes, comments that don't change behavior, or formatting and reproducible
generated files, there is no need to create `spec.md`/`plan.md` or wait for `plan approved`. Confirm the
scope, apply the change and run the relevant checks (`aquila-react-ai check` for documentation; generation +
`aquila-react-ai check` for generated files). Reviewing the diff is still mandatory.

This path does **not** apply to production code, configuration that changes runtime/gates, dependencies,
schema/API, security, CI, or when the impact is unclear. In those cases, use the medium path or the full flow
below.

## Medium path — small, local bug

One flow for everything turns small changes into paperwork (16 acceptance criteria for a one-line bug). For a
**bug whose root cause sits in one place**, up to 3 production files, with no schema/public API, security,
dependencies, CI or runtime config:

1. **3-line plan in the chat** (no `spec.md`/`plan.md`): root cause (with its callers) · fix · the test that
   proves it. Stop and wait for `plan approved`.
2. Test failing for the expected reason → minimal fix → [done checklist](done.md) → `aquila-review`.

If the investigation reveals more files, another layer or unclear impact, stop and switch to the full flow.

## 1. PLAN — `aquila-plan` (role `aquila-plan`)

- Read the code the task touches and the project's `docs/ai/CONTEXT.md` (only what the map points to). Track task → [tracks](tracks.md).
- Non-trivial task → short `spec.md` first: scope · acceptance criteria · invariants at stake · out of
  scope · what already exists vs. what the task adds.
- `plan.md` with **six sections**: **Goal · Impacted files/modules (with layer) · Current behavior ·
  Proposed change · Test strategy · Risks**. Self-contained: the executor reads only `AGENTS.md`,
  `docs/ai/CONTEXT.md` and `plan.md`.
- Bug → **root cause** and the single shared place to fix it (name every caller).
- Both at the root, ephemeral (never versioned). `plan.md` opens with `Task: <ticket or request> · Date:
  <YYYY-MM-DD>`: a `plan.md` from another task is not an approval — plan again. When the task closes, delete
  `spec.md` and `plan.md`.
- **Stop and wait for the dev's explicit approval: `plan approved` or `/aquila-execute`.** Nothing else starts
  the implementation ("ok", "looks good" or "go" without an approved plan → ask). `aquila-execute` is
  `disable-model-invocation` ([models](models.md)): the model never picks it by itself; on `plan approved` it
  reads its `SKILL.md` and follows it.

### Findings between phases

`plan.md` ends with `## Findings` (empty in the plan; not one of the six sections). Each later phase
**appends** at most ~10 lines, one per finding, never rewriting the others':
`<phase> · finding|warning|critique · file:line · one sentence with the evidence`
(e.g. `tests · finding · test/order.spec.ts:40 · fails because the repository does not check duplicates`).
The next phase reads the plan and this section, not the previous phase's conversation or logs: short findings
carry almost what the full reasoning does for a fraction of the tokens. Early findings are worth the most:
`aquila-tests` records why each test fails and what was missing (fixture, mock, data).

**Verify before adopting:** another phase's finding is evidence, not authority. Confirm it in the code or a
test before acting on it; if you reject it, append a `critique` with the reason.

## 2. TESTS — role `aquila-tests`

Tests first, **failing for the expected reason**. Single list of cases to cover (whichever apply):

- **every change**: a test that fails if the changed behavior breaks. Happy path, invalid/malformed input,
  external dependency failure (mocked) and state transitions **when applicable**; the test strategy
  justifies what doesn't apply;
- **UI (components, pages, hooks)**: loading · error (with retry) · empty · success states · user
  interactions (click, type, keyboard) · validation messages · double submit · permission-dependent UI ·
  accessible names/roles of what the user operates;
- **data (API client, cache, stores)**: request sent with the exact params · response mapping · cache
  invalidation/optimistic rollback · cancellation on unmount/param change;
- **When the change affects integration between components**, at least one real-flow test, not just
  mocks: entry → domain → output/effects (route rendered → user action → request/state → what the user
  sees), e.g. a page test with the router + MSW or an e2e test. Isolated changes justify why it doesn't
  apply.

Rules: never mock the unit under test; assert on value/state/payload **and** exact arguments; exact error
type and message. **Forbidden:** `only`/`skip`/`todo`, weakening or commenting out asserts, blindly
updating snapshots, changing a test to match a bug.

## 3. CODE — role `aquila-implement`

The minimum code that turns the tests green, preserving the project's invariants. Reuse before writing;
follow the golden file of the same type ([golden files](golden-files.md)); API types only from the
contract (generated or confirmed in the backend).

**Refactor without behavior change** (plan and `plan approved` all the same): the tests that already cover the
behavior are the safety net. The TESTS phase only adds tests where that coverage is missing — those pass right
away, as expected; the code changes with the tests always green. If a test has to change, it is not a refactor.

## 4. VALIDATION — [done checklist](done.md)

Iterate on touched tests only; at the end, the whole checklist green. Then, role `aquila-review` on the diff.
`aquila-review` is the synthesizer: it treats `aquila-implement`'s close and the `## Findings` as evidence to
confirm, not as a verdict, and does not reopen the plan. Serious findings → fixed by the phase that owns them
(test → `aquila-tests`, code → `aquila-implement`), then `gate ci` again and another review; at most two
cycles, then report to the dev. The other findings go in the close for the dev to decide.

## 5. Small PRs

Huge PRs don't get a real review: approval happens out of fatigue and the problems ship with it. The limit
is `docs/ai/aquila.json` → `review.prMaxFiles` (default **30** changed files, set at init).

- **In the plan:** if the planned change exceeds the limit, propose it in increments from the start — one
  branch/PR per increment, each with up to `prMaxFiles` files, green and reviewable on its own, in merge order.
- **Before opening the PR / in review:** count the diff's files against the base
  (`git diff --name-only <base>...HEAD`), not counting generated and managed files (`.aquila/`, `.aquila-hooks/`,
  the routers, `.claude/commands/aquila-*`, `.github/workflows/aquila-gates*.yml`, `docs/ai/lint-baseline.json`). Above the limit → suggest how to split (by layer, feature folder or
  plan step) and offer to create the smaller branches and PRs. The dev decides; never split without
  approval. Other generated files (lockfiles, codegen) and mass renames count, but justify an explicit exception.
