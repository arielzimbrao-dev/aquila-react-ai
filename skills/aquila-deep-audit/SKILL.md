---
name: aquila-deep-audit
description: >-
  Deep product audit: business, security, performance, errors, contracts, data and operations. Rates findings by severity and writes audit_<datetime>.md at the root. Use for "/aquila-deep-audit", "deep audit", "audit the product risks".
---

# aquila-deep-audit — deep product audit

Analyzes the project where aquila-react-ai is applied, not just adoption of the method. Scope: `$ARGUMENTS`;
by default, the whole accessible product, including configuration and operations. A partial scope keeps
the remaining areas in the report as not verified. It does not promise to find every flaw.

1. Confirm the root, Git state and scope; follow
   [`core/tokens.md`](../../core/tokens.md) before deep reading. If there is a warning, wait for
   approval of cost/scope. Reuse existing context, but confirm it in the code.
2. Run the methodology in [`core/deep-audit.md`](../../core/deep-audit.md): inventory, coverage,
   flow tracing, safe checks and evidence-based severity rating.
3. Create **`audit_<datetime>.md` at the repository root**, following the
   [report template](references/report-template.md). The datetime is UTC with milliseconds, without
   characters invalid on Windows: `audit_20261030T120000123Z.md`. Do not overwrite another report.
4. Check structure, links, severity counts, sanitization and limits; summarize the biggest risks and
   point to the persisted report. If you cannot write it, report the blocker: text in the chat is not
   a created file.

**Write limit:** only this run's report; no fixes, installs, commits or push.
Tests, scanners and project commands only after checking side effects and getting the required
authorization. Never use production, personal data or real secrets in reproductions. Without a tool or
permission, record the gap; do not invent results. Do not apply fixes on your own initiative.

`/aquila-audit` assesses adoption of the method; `/aquila-review` reviews a diff. This command looks for
cross-cutting risks and product flaws, even outside recently changed code.
