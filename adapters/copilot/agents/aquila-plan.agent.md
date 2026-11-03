---
name: aquila-plan
description: 'PLAN phase: spec.md + 6-section plan.md; stops at plan approved.'
tools: ['search', 'read', 'edit', 'web/fetch', 'execute']
handoffs:
  - label: Write the tests
    agent: aquila-tests
    prompt: plan approved. Write the failing tests per the Test strategy in plan.md.
    send: false
---

Read and follow `.aquila/agents/aquila-plan.md` (single copy, shared with Claude and Codex). Do not add rules here.
