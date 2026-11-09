---
name: aquila-guideline
description: >-
  Creates or refines a track (≥3 tickets with shared contracts) in docs/tracks/. Use for "new track", "epic", "master plan", "/aquila-guideline".
model: opus
---

# aquila-guideline

Input: the epic/set of tickets and the context (`$ARGUMENTS`). Rules:
[`core/tracks.md`](../../core/tracks.md). Template: [`TRACK.md`](../../templates/docs/tracks/TRACK.md).

1. **Confirm it is a track**: ≥3 tickets sharing at least one contract. Otherwise, propose
   `aquila-plan` per ticket and stop.
2. **Read the real code** the tickets touch; list what exists vs. what is missing. Tickets may contain
   analysis errors: record the **factual corrections** in their own section, with the source in the code.
3. **Extract the shared contracts** (event, identity, table, boundary, config/flags, observability,
   security, cost) — each numbered, with its owning task. Global contracts (C4, events, routes) stay in
   the project's single source; the track points to them.
4. **Tasks**: one entry per ticket (`ID — name (tracker) — where it lives — gotcha`), dependencies and
   build order (critical path), real-flow test covering the contracts.
5. Track-specific **PLAN checklist**.
6. Write `docs/tracks/<name>/<NAME>.md` (+ `<NAME>_backlog.md` if > 30 KB; attachments in the same
   folder) and register the row in `docs/tracks/README.md`. Run `npx aquila-react-ai check`.

Optional, on request: each ticket's text ready to paste into the tracker (Markdown).
