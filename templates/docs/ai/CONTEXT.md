# CONTEXT.md — project rules and map

> Project knowledge for AI agents (method: `aquila-react-ai`). **(to fill in)** — the `aquila-docs` skill
> fills it from the code; the dev validates. Precedence: `.aquila/core/precedence.md` — real code wins.
> Budget: ≤ 14.5 KB. Long detail goes to `docs/`; only the pointer stays here.

## 1. Overview

<5 lines: what the system does, for whom, main inputs and outputs.>

**Stack:** React <version> · <framework/bundler (Vite, Next.js…) · router · data/state libs · design system · hosting> (versions: `package.json`).

## 2. Map: problem → where to look

Start here and at [`docs/c4/`](../c4/README.md); **then** confirm in the code. No broad sweeps.

- <Area/problem> → `<real path>` (<key file>) · doc: <link>
- Task from a track → [`docs/tracks/README.md`](../tracks/README.md)
- Per-folder rules → [`.github/instructions/`](../../.github/instructions/) (`applyTo`)
- Build/change (recipes, API, events, conventions) → [`docs/reference/`](../reference/README.md) ·
  operate (diagnosis, replay, rollout) → [`docs/runbooks/`](../runbooks/README.md)

## 3. Layers

<Which layers exist (app shell, routes/pages, features, shared components, hooks, API client, stores),
which folder holds each, what each may import. A component or API call in the wrong folder is a bug.>

## 4. Invariants (always preserve)

- <e.g.: server data only through the query layer; no secrets in client env>
- <e.g.: every async view has loading/error/empty states; UI only from the design system>

## 5. Large docs (read by section only)

- <file> — <which section to open for what>

## 6. Git and deploy

- Branches: <convention> · PR to <branch> · deploy: <CI/CD only?>
