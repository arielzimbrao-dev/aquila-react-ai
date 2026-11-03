# Per-folder instructions

One `<area>.instructions.md` file per area with its own rules. Copilot loads them automatically via
`applyTo`; other agents open the one for the folder they will touch. Only the **delta** relative to
[`docs/ai/CONTEXT.md`](../../docs/ai/CONTEXT.md) — ≤ 2.5 KB each (`npx aquila-react-ai check` warns about
code files without instructions).

Format:

```markdown
---
applyTo: 'src/<area>/**,src/other/folder/**'
---

# Context: <area>

Open **only** <doc/section>. General invariants: CONTEXT.md §4; here only the delta:

- <rule that bites here>
```
