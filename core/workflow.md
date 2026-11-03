# Mandatory flow: SDD → TDD

Every task that changes production code follows these phases, in this order. Each phase has a role in
[`../agents/`](../agents/) and an `aquila-*` command.

## Short path — changes with no behavioral impact

For text/link/documentation fixes, comments that don't change behavior, or formatting and reproducible
generated files, there is no need to create `spec.md`/`plan.md` or wait for `plan approved`. Confirm the
scope, apply the change and run the relevant checks (`aquila-react-ai check` for documentation; generation +
`aquila-react-ai check` for generated files). Reviewing the diff is still mandatory.

This path does **not** apply to production code, configuration that changes runtime/gates, dependencies,
schema/API, security, CI, or when the impact is unclear. In those cases, use the full flow below.

## 1. PLAN — `aquila-plan` (role `aquila-plan`)

- Read the code the task touches and the project's `docs/ai/CONTEXT.md` (only what the map points to). Track task → [tracks](tracks.md).
- Non-trivial task → short `spec.md` first: scope · acceptance criteria · invariants at stake · out of
  scope · what already exists vs. what the task adds.
- `plan.md` with **six sections**: **Goal · Impacted files/modules (with layer) · Current behavior ·
  Proposed change · Test strategy · Risks**. Self-contained: the executor reads only `AGENTS.md`,
  `docs/ai/CONTEXT.md` and `plan.md`.
- Bug → **root cause** and the single shared place to fix it (name every caller).
- Both at the root, ephemeral (never versioned). **Stop and wait for `plan approved`.** No other phrase
  starts the implementation.

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

## 4. VALIDATION — [done checklist](done.md)

Iterate on touched tests only; at the end, the whole checklist green. Then, role `aquila-review` on the diff.

## 5. Small PRs

Huge PRs don't get a real review: approval happens out of fatigue and the problems ship with it. The limit
is `docs/ai/aquila.json` → `review.prMaxFiles` (default **30** changed files, set at init).

- **In the plan:** if the planned change exceeds the limit, propose it in increments from the start — one
  branch/PR per increment, each with up to `prMaxFiles` files, green and reviewable on its own, in merge order.
- **Before opening the PR / in review:** count the diff's files against the base
  (`git diff --name-only <base>...HEAD`). Above the limit → suggest how to split (by layer, feature folder or
  plan step) and offer to create the smaller branches and PRs. The dev decides; never split without
  approval. Generated files or mass renames count, but justify an explicit exception.
