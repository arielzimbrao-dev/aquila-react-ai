---
name: aquila-plan
description: >-
  Plans a task: spec.md if non-trivial + 6-section plan.md; stops at `plan approved`. Use for "plan", "/aquila-plan" or before changing production code.
model: opus
---

# aquila-plan

Input: the ticket/request (`$ARGUMENTS` or the user's text). If the goal is missing, ask once.

1. Act as the [`aquila-plan`](../../agents/aquila-plan.md) role (subagent when the tool supports it).
2. If the ticket has a prefix/epic registered in `docs/tracks/README.md`, follow
   [`core/tracks.md`](../../core/tracks.md).
3. Deliver `spec.md`/`plan.md` at the root and a 5-line summary: goal, files/layers, tests, risks,
   open questions.
4. **Stop.** Only `plan approved` (or `/aquila-execute`) starts the implementation.
