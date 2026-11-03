# Task tracks

A **track** is a set of tasks on the same context that **share contracts** (event, identity, table,
boundary): each ticket was refined against the others, so the track contract beats the ticket text, and
the real code beats the track ([precedence](precedence.md)).

A project's tracks live in `docs/tracks/` and are registered in `docs/tracks/README.md` (track →
contract → tasks → PLAN checklist). Create or refine: `aquila-guideline` command.

## Working a track task

1. Identify the track by the ticket prefix/epic in the registry. Open **only**: the contract sections the
   task touches, the task entry and the PLAN checklist — **never** the whole file.
2. Confirm dependencies: the tasks you depend on are closed or the contract already exists in code.
3. Import shared logic from the single source the contract names — never clone it in a task.
4. Follow the [workflow](workflow.md); `plan.md` cites the contract sections used.
5. Closing: if the task changed a contract, the order or the dependencies, update the track **in the same
   PR** (and the task status). Generated track artifacts are regenerated in the same commit.

## Track skeleton (`docs/tracks/<name>/<NAME>.md`)

One folder per track: the contract `<NAME>.md`, the backlog `<NAME>_backlog.md` (if > ~30 KB) and the
track attachments (analyses, task contracts, generated artifacts). Runbooks and usage reference the track
produces go to `docs/runbooks/` and `docs/reference/` (they belong to the system, not the track).

Create one when ≥3 tickets share contracts. Template: `.aquila/templates/docs/tracks/TRACK.md`.

1. **How to read + precedence** — "open only §…"; the document beats the ticket, the code beats the document.
2. **What it is** — scope and boundaries.
3. **Shared contracts** — numbered (§3.x), each with the owning task and the source in code.
4. **Tasks** — one entry per task (`ID — name (ticket) — where it lives — gotcha`); above ~30 KB it moves
   to `<NAME>_backlog.md` (planning, not contract).
5. **Order and dependencies** · **real-flow test** covering the contracts end to end.
6. **PLAN checklist** — what the agent confirms before writing `plan.md`.

Contracts that don't belong to a single track (events, schema, routes) stay in the project's single
source (`docs/c4/`, event catalog, API reference); the track points there instead of copying them.
