# <NAME> — Master plan (<task prefix, e.g.: T01–T12>)

> **How to read:** open only the relevant §3.x + the task entry in §4 + the §7 checklist; never the
> whole file.
>
> **Precedence:** real code wins over this document; this document wins over the ticket text (it was
> validated against the code). When closing a task that changes a contract (§3) or the order (§6),
> update this file in the **same PR**.

## 1. What it is

<Scope, boundaries, epic.>

## 2. Fact corrections

<What the tickets get wrong, with the source in the code.>

## 3. Shared contracts (every task implements against these)

### 3.1 <Contract> (owner: <task>)

<Definition, single source in the code, rules.>

## 4. Tasks

- **<ID>** — <name> (<ticket>) — <where it lives> — <gotcha>.

## 5. Real-flow test

<The test that covers the contracts end to end and where it lives.>

## 6. Order and dependencies

<Graph/critical path.>

## 7. PLAN checklist for any task in this track

1. I read §3 and my contract matches it.
2. The §6 dependencies are closed or the contract exists.
3. I am not cloning shared logic — I import from the single source.
4. I confirmed against the real code.
