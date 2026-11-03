# Deep audit — <project>

> Template: replace every field, do not invent evidence. Remove template instructions on
> delivery. With no findings in a section, write "none identified within the verified scope", with limits.

## Executive summary

- Status: completed within the declared scope / partial, with reason.
- Start/end: UTC; repository, branch, commit and local changes.
- Environment and tools actually available.
- Confirmed defect counts: CRITICAL / HIGH / MEDIUM / LOW.
- Hypotheses and improvements counted separately; biggest risks and priority actions.
- Absence of findings does not prove absence of flaws.

## Scope and context

Request, requirement sources and confirmed invariants, modules, critical flows and exclusions.
Access/permission limits, cost/context and authorized decisions. Do not attribute rules to the domain
that have not been confirmed.

## Coverage

| Area / flow | Status | Files/contracts traversed | Evidence | Gap / next step |
|---|---|---|---|---|
| Business | verified within declared scope / partial / not verified / not applicable | ... | ... | ... |

Include every methodology area, even without evidence; justify "not applicable".

## Checks run

| ID | Authorized scenario / command | Expected | Observed / exit code | Observed time | Limitations |
|---|---|---|---|---|---|
| V-001 | ... | ... | ... | ... | ... |

Distinguish reading/tracing, real test, static contract, simulation and proposed-but-not-run test.
Do not present a passing smoke test as full functional validation or a benchmark.

## Findings

Only confirmed defects/missing protections with a substantiated risk, ordered by severity and
confidence. Unique IDs, consistent between table and detail.

| ID | Severity | Category | Confidence | Status | Location | Finding / impact | Evidence |
|---|---|---|---|---|---|---|---|
| DA-001 | 🟠 HIGH | ... | 9/10 | confirmed by execution / tracing | file:line | ... | V-001 / tracing |

### DA-001 — <title>

- **Severity and rationale:** impact, likelihood, reach and barriers.
- **Confidence and status:** facts and assumptions.
- **Location / root cause:** relative link to an existing file and line; affected callers.
- **Expected / observed:** contract and deviation.
- **Impact:** business, data, security or operations.
- **Conditions:** preconditions and existing protections.
- **Safe reproduction / tracing:** synthetic steps, authorization and result; no secrets.
- **Recommendation:** concrete fix/protection at the shared source; not applied automatically.
- **Proposed regression test:** input, expected result and effect to prevent.

## Hypotheses

| ID | Potential severity | Confidence | Available evidence | What is missing / how to validate |
|---|---|---|---|---|
| H-001 | ... | ... | ... | ... |

Do not mix hypotheses into confirmed defect counts.

## Improvements

| ID | Priority | Benefit / protection | Evidence / motivation | Proposed action and validation |
|---|---|---|---|---|
| M-001 | ... | ... | ... | ... |

Preventive improvements without a proven flaw; do not assign defect severity without demonstrated risk.

## Protections

Existing, verified protections, the limits of each and justified additional protections.
Action plan: containment, fix, prevention and validation; dependencies/decisions to confirm.

## Limitations

Inaccessible areas, missing tools, commands not run and why, uncertain requirements,
untested environments/runtimes/agents, sampling, budget and residual risk.
Next steps to complete coverage. Confirm that only this report was written by the audit, or
explicitly state authorized and observed side effects.
