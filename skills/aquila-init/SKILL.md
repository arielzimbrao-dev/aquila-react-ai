---
name: aquila-init
description: >-
  Prepares the project for its first plan: takes the existing repository into account, asks language, tools, tokens, mode and lint; sets up docs, CI, hooks and agents and validates the gates. Use for "install aquila-react-ai", "/aquila-init".
---

# aquila-init — initial setup

Main entry command: when it finishes, the dev can ask for `/aquila-plan` without any further setup or
documentation step. The CLI does the deterministic part; this skill interprets the repository,
confirms decisions and completes the setup. Never mistake copied templates for filled-in docs.
If `/aquila-init` is not registered yet, the request "follow `.aquila/skills/aquila-init/SKILL.md`"
starts this same procedure; it does not require installing the plugin or agent settings first.

## 1. Inventory before changing anything

Work at the project root. Confirm `node --version` (>= 22), the Git state, that `package.json` lists
`aquila-react-ai` in `devDependencies`, that `node_modules/aquila-react-ai/bin/aquila.mjs` exists and whether
`docs/ai/aquila.json` exists. If the package is missing, explain `npm i -D aquila-react-ai` (or the pnpm/yarn
equivalent); if `node_modules` is missing, run the project's install. Do not proceed with incomplete files.

Inventory by metadata first; open only the files that back the configuration:

- manifests, lockfiles, scripts, workspaces, source/test folders and runtime versions;
- existing documentation, decisions and diagrams, even outside `docs/`;
- CI workflows, their commands and branches, `core.hooksPath` and existing hooks (Husky etc.);
- routers/instructions/agents and tool settings, including ones already committed;
- aquila-react-ai configuration and local options, if present.

Preserve local changes and team content. Existing configuration is the baseline, not a reason to start
over; in a fresh clone, reuse valid docs and decisions and prepare only what is missing.
Stack change or conflict with the configuration → show the difference and confirm before replacing.

## 2. Confirm choices with context

Ask **one single question** covering the six choices below, in the dev's preferred language. Show the
current value (if any), the recommendation and the practical effect; accept "keep" or "use the
recommended". Do not offer closed configuration bundles. Ask follow-up questions only for decisions or
commands the repository cannot confirm.

| Option | Recommendation for a new project | What it changes |
|---|---|---|
| Language | `en` (`pt-BR`/`pt-PT` if that is the team's) | conversation and docs; code stays in English |
| Tools | `copilot,claude,codex`, trimmed to what the team uses | which agents, skills and settings to prepare |
| Monthly token limit | `none` or a positive number | personal alert; outside git, does not measure real usage |
| Mode | `local`; recommend `team` if there are cloud agents/AI PR review or routers already shared | `local`: each dev generates their own adapters; `team`: committed routers/settings reach teammates and the cloud |
| Lint | `standard`; `off` or `high` if chosen | aquila-react-ai rules off, base or extra; enforcement depends on ESLint being installed |
| Max PR size | `30` changed files | above it agents propose splitting into incremental branches/PRs ([workflow §5](../../core/workflow.md)) |

In both modes, docs, configuration and CI are shared. Hooks are local to each clone: **even in
`team`, every dev runs the CLI `init`**. The Claude plugin also needs a per-machine install;
shared settings do not install it. Details and transitions:
[`README.md` § Local vs team mode](https://github.com/arielzimbrao-dev/aquila-react-ai#local-vs-team-mode).

## 3. Install and integrate with what exists

```bash
npx aquila-react-ai init --lang=<language> --tools=<list> --token-limit=<limit|none> --mode=<local|team> --lint=<off|standard|high> --pr-max-files=<n>
```

Use the confirmed answers. The CLI creates missing configuration, copies templates without overwriting,
generates adapters/settings, sets `core.hooksPath` and generates the CI workflow. Then interpret every
`!` and `✗`:

1. **Gates and runtimes:** compare detection with the real `package.json` scripts, monorepos and tools
   already in use. Fill `gates`, `hooks` and `ci` without inventing commands. Without suitable checks,
   the setup stays incomplete.
2. **CI:** `.github/workflows/aquila-gates.yml` is self-contained (checkout, setup-node, install,
   `npx aquila-react-ai check`, `npx aquila-react-ai gate ci`) and derives from `aquila.json → ci`. Keep existing
   jobs, branches, permissions and deploy; avoid duplicate checks and do not overwrite a manually edited
   workflow. Confirm the integration with the dev on conflict. Do not declare remote CI green just
   because the file exists.
3. **Hooks:** if Husky or another manager exists, add `npx aquila-react-ai gate pre-commit` and
   `npx aquila-react-ai gate pre-push` to the right hooks, preserving existing calls without duplicating them.
   Do not replace the manager.
4. **Agents:** check routers, existing specific rules and settings for each chosen tool.
   In `local`, committed routers are not replaced: resolve the warning with the dev (e.g. choose
   `team`); do not ignore the missing method. Never remove files from the Git index automatically.
5. **Lint and plugins:** resolve `lint.pending` with the dev; do not describe it as active enforcement.
   Missing dependencies → confirm the install/manifest changes and use the project's package manager.
   For Claude, run `claude plugin marketplace add ./.aquila` and
   `claude plugin install aquila@aquila-react-ai --scope local` (`--scope project` in `team`) and verify the
   install. For a tool unavailable on this machine, state what you did not verify.

## 4. Document within init

Before reading the code in depth, follow the usage warning in
[`core/tokens.md`](../../core/tokens.md). **Run the [`aquila-docs`](../aquila-docs/SKILL.md) procedure
as part of this install, without asking the dev for another command**: incorporate existing docs,
fill/update `CONTEXT.md`, real golden files, per-area instructions, C4 and indexes from the code. Do not
duplicate the generation rules here.

In an already prepared project, confirm the facts and update only the drift; do not rewrite valid docs.
In a repo without code, record that state and what does not apply yet; never invent layers,
invariants or golden files. Show conflicts and "to confirm" facts for the dev to validate, especially
those affecting the first plan. Do not create ADRs for decisions the team has not made.

## 5. Validate the final state

After the docs and resolving integrations, run:

```bash
npx aquila-react-ai sync
npx aquila-react-ai doctor
npx aquila-react-ai check
npx aquila-react-ai check --ready
npx aquila-react-ai gate ci
```

`doctor` is diagnostic and can exit 0 with `✗`; `check` can pass with unfilled templates.
`check --ready` is strict and local: it fails on missing/empty/template essential docs, empty gates,
pending lint or unresolved configured integrations. It does not run gates nor prove doc facts or
remote CI. If a selected tool is unavailable on this machine, record the blocker; do not remove it from
the configuration just to pass. CI keeps using plain `check`, without requiring local agent installs
on the runner.
Read the results, not just exit codes. Confirm useful docs, links and budgets, adapters in sync,
hooks actually wired and gates defined/executed. Check the diff and that no team content was lost.
Gates needing unavailable services/credentials or pre-existing failures → show the blocker; do not
disable them to get green. Distinguish local gate runs from remote workflow runs.

## 6. Close with readiness or blockers

Summarize choices, what was reused/created/changed, checks run and files to commit
(`docs/`, per-area instructions, CI, `package.json` and lockfile; routers/settings in `team`).
Ask the dev to review the docs and the diff, without committing.

- **Ready for the first plan:** contextualized docs, required decisions confirmed, agents and
  integrations prepared and applicable validations green → next command **`/aquila-plan <request>`**.
- **Incomplete setup:** list each blocker, evidence, action and owner; do not declare ready with
  templates, missing gates, pending lint or unresolved integrations.

`/aquila-docs` remains available for doc maintenance, `/aquila-config` to change choices and
`/aquila-audit` for a broader assessment. None is a mandatory manual step after this init.
