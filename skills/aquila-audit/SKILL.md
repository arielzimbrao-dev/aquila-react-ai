---
name: aquila-audit
description: >-
  Read-only audit of the project against aquila-react-ai (installation, docs, gates, quality, agent efficiency) with a ranked report. Use for "audit the project", "/aquila-audit".
---

# aquila-audit — project audit

This command assesses **adoption of the method**. To look for cross-cutting product flaws and risks
(business, security, performance, contracts and operations), use
[`aquila-deep-audit`](../aquila-deep-audit/SKILL.md), which writes a severity-rated report at the root.

**Read-only**: changes no files; proposes and the dev decides. Scope: `$ARGUMENTS` (e.g. `docs`, `gates`,
`quality`) or everything. Every finding is **verified** (command run, file read) — no generic advice.
Before reading the code: [`core/tokens.md`](../../core/tokens.md) § High-consumption warning.

## 1. Mechanical checks (CLI)

```bash
npx aquila-react-ai doctor
npx aquila-react-ai check
npx aquila-react-ai lint rules
```

And, if the dev allows (they can be slow), `npx aquila-react-ai gate ci` and `npx aquila-react-ai lint`.

## 2. What you assess

1. **Installation** — `aquila-react-ai` in `devDependencies` and up to date, `aquila.json` consistent with the
   real React project (gates that exist and run, `coverage.enforced` true, `lint.pending`), hooks,
   `aquila-gates.yml`, per-tool adapters, suitable `mode` (cloud agents or AI PR review → `team`).
2. **Documentation** ([`core/docs.md`](../../core/docs.md)) — six folders; each doc in the right folder;
   the `CONTEXT.md` map points to paths that exist; invariants present; golden files current;
   per-folder instructions cover the code and hold only the delta; C4 matches the real modules; doc-sync
   up to date (events, routes, schema documented); generated docs current.
3. **Gates and quality** — CI gates vs `core/done.md`; sample of recent code (e.g. last commits) against
   the level's rules (`lint rules`, including the "(review)" ones), layers and invariants; tests with the
   cases from [`core/workflow.md`](../../core/workflow.md) §2. `eslint-disable` of local rules equivalent
   to aquila-react-ai's (e.g. `local/max-params`) → `lint.options.aliases`
   ([`core/quality.md`](../../core/quality.md)).
4. **Agent efficiency** ([`core/tokens.md`](../../core/tokens.md)) — size of what is always loaded
   (routers), budgets, large docs without an index, instructions pointing to whole docs instead of the
   section, duplication across docs (one home per rule).
5. **Consistency** — contradictory rules across docs, instructions and code; stale paths.

## 3. Report

Ranked list, most severe first, one line per finding:
`[area] file:line — problem → fix (how I verified)`. Then a 3-line verdict and the 3 highest-impact
fixes. If the dev asks, publish it as a page to share with the team.
