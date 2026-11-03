# Project documentation

All documentation lives in `docs/`, versioned, in **six folders** — the same in every project (created by
`aquila-react-ai init`, each with an index `README.md`). A new document goes into the folder matching its
nature; if it fits none, default to `reference/`.

| Folder            | Nature                       | Examples                                                                                                                                         | Command                       |
| ----------------- | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------- |
| `docs/ai/`        | knowledge for agents         | `CONTEXT.md` (map, layers, invariants), `aquila.json`, `golden.md`, `skills/` (optional)                                                         | `aquila-init` / `aquila-docs` |
| `docs/c4/`        | **what** the architecture is | C4 levels, dynamic diagrams, external systems (APIs, auth, CDN), app shell and state architecture deep dives                                    | `aquila-c4`                   |
| `docs/adr/`       | **why** it is so             | `ADR-NNN-title.md`; analyses and studies backing decisions in `adr/research/`                                                                     | `aquila-adr`                  |
| `docs/tracks/`    | **what is being built**      | registry + one folder per track (`<name>/` with the contract, backlog and track attachments)                                                     | `aquila-guideline`            |
| `docs/reference/` | **how to use and build it**  | route/screen map, API client contract, design system usage, code conventions, recipes ("new page/form/field"), generated docs (flags, deps)  | —                             |
| `docs/runbooks/`  | **how to operate it**        | diagnosis, deploy/rollback, feature-flag rollout, cache/CDN purge, access                                                                        | —                             |

Per-folder code rules (`applyTo` frontmatter) live outside `docs/`, in `.github/instructions/`: Copilot
reads them on every surface (VS Code, PR review, coding agent) and other agents open the one for the
folder they will touch.

`/aquila-init` includes the project documentation via the `/aquila-docs` procedure; the CLI `init` only
copies missing templates. The `/aquila-docs` skill can also be run on its own for maintenance.

## Rules

- **One home per rule/fact**: other documents point, they don't copy.
- **Doc-sync in the same PR**: a file changed layer, a route/screen was born, the API contract or
  an integration changed → update the C4 / reference / track in the same task.
- **Domain knowledge is documentation**, not a skill: recipes and pitfalls go to `reference/` and the
  `CONTEXT.md` map says when to open them. `docs/ai/skills/` only for flows that really need to be a skill
  (a command with its own steps and tools).
- Large docs (> 30 KB) have an index at the top and are read by section; `CONTEXT.md` says which.
- Generated docs are regenerated in the same commit; CI compares them.
- Valid relative links and size budgets: `npx aquila-react-ai check`.
- When finishing local setup: `npx aquila-react-ai check --ready` also rejects essential docs that are missing,
  empty or still template. It does not prove the facts are true: human review still applies.
