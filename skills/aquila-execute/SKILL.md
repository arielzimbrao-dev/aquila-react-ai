---
name: aquila-execute
description: >-
  Executes an approved plan.md: failing tests → minimal code → gates → review. Use for "plan approved", "execute the plan", "/aquila-execute".
model: sonnet
disable-model-invocation: true
---

# aquila-execute

Precondition: `plan.md` at the root, of this task (its `Task:` line), approved by the dev
([`core/workflow.md`](../../core/workflow.md) §1). Otherwise → run `aquila-plan` and stop.

Phases, in order — each in the given role (subagent when the tool supports it; otherwise in the same
session, reading the role file before starting the phase and checking the role's model level,
[`core/models.md`](../../core/models.md)):

1. **Tests** — [`aquila-tests`](../../agents/aquila-tests.md). Show the failing tests and why they fail.
2. **Code** — [`aquila-implement`](../../agents/aquila-implement.md). Iterate only on the touched tests.
3. **Gates** — `npx aquila-react-ai gate ci` (commands from `docs/ai/aquila.json`); fix until green. A red gate that
   is not the task's → [`core/done.md`](../../core/done.md).
4. **Review** — [`aquila-review`](../../agents/aquila-review.md) on the diff; the findings cycle (at most two)
   is in [`core/workflow.md`](../../core/workflow.md) §4.

Close: what changed · what was verified (commands and result) · what is still to verify · risks/assumptions
for the dev to review · docs updated. Delete `spec.md`/`plan.md`. Commit/push only on request (or per
`workflow.autoCommit`). If the QA comment is requested → `aquila-test-comment`.
