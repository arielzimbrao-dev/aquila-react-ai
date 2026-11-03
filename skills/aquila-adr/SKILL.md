---
name: aquila-adr
description: >-
  Writes a numbered ADR in docs/adr/ (context, options, decision, consequences). Use for "ADR", "record the decision", "/aquila-adr".
---

# aquila-adr

1. Next number: the highest `docs/adr/ADR-NNN-*.md` + 1. Name: `ADR-NNN-kebab-case-title.md`.
2. Fill the [template](../../templates/docs/adr/ADR-000-template.md) from the request and the **real
   code** (confirm every fact). Options with honest pros/cons; the decision states what changes and what
   does not.
3. Initial status `Proposed`; `Accepted` only when the user says so.
4. If the ADR changes a rule, update that rule's single source (`docs/ai/CONTEXT.md`, C4, track) and link
   to the ADR. Run `npx aquila-react-ai check`.
