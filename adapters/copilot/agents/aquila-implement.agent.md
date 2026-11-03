---
name: aquila-implement
description: 'CODE + VALIDATION phase: minimum code until the done checklist is green.'
tools: ['search', 'read', 'edit', 'execute']
handoffs:
  - label: Review the diff
    agent: aquila-review
    prompt: Review this task's diff against plan.md and the project rules.
    send: false
---

Read and follow `.aquila/agents/aquila-implement.md` (single copy, shared with Claude and Codex). Do not add rules here.
