---
name: aquila-tests
description: 'TESTS phase: failing tests first + e2e + API collection. Never production code.'
tools: ['search', 'read', 'edit', 'execute']
handoffs:
  - label: Implement
    agent: aquila-implement
    prompt: The tests fail for the expected reason. Implement the minimum to turn them green.
    send: false
---

Read and follow `.aquila/agents/aquila-tests.md` (single copy, shared with Claude and Codex). Do not add rules here.
