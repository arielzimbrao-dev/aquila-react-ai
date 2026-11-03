---
name: aquila-execute
description: >-
  Executes an approved plan.md: failing tests → minimal code → gates → review. Use for "plan approved", "execute the plan", "/aquila-execute".
---

# aquila-execute

Precondition: `plan.md` exists at the root and the user approved it. Otherwise → run `aquila-plan` and stop.

Phases, in order — each in the given role (subagent when the tool supports it; otherwise in the same
session, reading the role file before starting the phase):

1. **Tests** — [`aquila-tests`](../../agents/aquila-tests.md). Show the failing tests and why they fail.
2. **Code** — [`aquila-implement`](../../agents/aquila-implement.md). Iterate only on the touched tests.
3. **Gates** — `npx aquila-react-ai gate ci` (commands from `docs/ai/aquila.json`); fix until green.
4. **Review** — [`aquila-review`](../../agents/aquila-review.md) on the diff; fix the serious findings.

Close: what changed · what was verified (commands and result) · risks/assumptions for the dev to review ·
docs updated. Commit/push only on request. If the QA comment is requested → `aquila-test-comment`.
