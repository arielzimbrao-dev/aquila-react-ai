---
name: aquila-review
description: >-
  Read-only review of a diff/PR against invariants, layers, tests, gates and doc-sync. Use for "review", "/aquila-review".
model: sonnet
---

# aquila-review

Target: `$ARGUMENTS` (branch, PR or files); by default the working tree diff against the base branch.

Act as the [`aquila-review`](../../agents/aquila-review.md) role (subagent when the tool supports it —
preferably with a cheaper model). Do not edit files; propose and the author decides.
