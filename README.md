<p align="center">
  <img src="assets/logo.svg" width="140" alt="aquila-react-ai logo — a red eagle head" />
</p>

<h1 align="center">aquila-react-ai</h1>

<p align="center">
  <b>Give your AI coding agents an eagle's eye.</b><br/>
  A battle-tested, spec-driven development method for <b>React</b> — one install, the same discipline in
  <b>Claude Code</b>, <b>GitHub Copilot</b> and <b>OpenAI Codex</b>.
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/aquila-react-ai"><img alt="npm" src="https://img.shields.io/npm/v/aquila-react-ai?color=E0234E&label=npm"></a>
  <img alt="React" src="https://img.shields.io/badge/React-17%E2%86%9219-61DAFB?logo=react&logoColor=black">
  <img alt="Claude Code" src="https://img.shields.io/badge/Claude%20Code-ready-D97757">
  <img alt="GitHub Copilot" src="https://img.shields.io/badge/GitHub%20Copilot-ready-24292f?logo=githubcopilot&logoColor=white">
  <img alt="Codex" src="https://img.shields.io/badge/OpenAI%20Codex-ready-10a37f">
  <img alt="Zero dependencies" src="https://img.shields.io/badge/dependencies-0-brightgreen">
  <a href="LICENSE"><img alt="MIT" src="https://img.shields.io/badge/license-MIT-blue"></a>
</p>

---

Version **0.3.0**

<!-- aquila-family:start -->
## The aquila family

The same method, one package per stack — each one speaks only its own technology (conventions, lint
plugins, presets). They share the mechanics: the git hook dispatcher (`.aquila-hooks/`, byte-identical in
the three), the CI workflow and the gates, so a NestJS backend and a React or Next.js frontend in the same
repository work side by side. Upgrade them together.

| Package | Stack |
|---|---|
| [**aquila-ai**](https://www.npmjs.com/package/aquila-ai) | NestJS |
| [**aquila-react-ai**](https://www.npmjs.com/package/aquila-react-ai) | React (this package) |
| [**aquila-next-ai**](https://www.npmjs.com/package/aquila-next-ai) | Next.js |
<!-- aquila-family:end -->

## Why aquila-react-ai?

AI agents write code fast. Left alone, they also **skip tests, sprinkle `useEffect` everywhere, forget
loading and error states, ignore accessibility, use React APIs that don't exist in your version, open
80-file PRs and burn through your token budget** re-reading the whole repo.

aquila-react-ai turns any agent into a disciplined teammate:

| Without a method | With aquila-react-ai |
|---|---|
| The agent starts coding straight from a vague prompt | A **spec + 6-section plan**, then a hard stop until you say `plan approved` |
| Tests written after the fact (or never) | **TDD**: failing tests first, minimal code, gates green before "done" |
| Generic TypeScript that ignores React idioms | **Official React conventions**, version-aware (17 → 19.3, focus on **18 and 19**), framework-aware (Vite, Next.js, React Router) |
| Every tool configured differently | **One method** for Claude Code, Copilot and Codex, generated from one config |
| 2,000-line context files loaded on every prompt | **Token economy**: ≤ 3.5 KB always loaded, the rest read on demand |
| Huge PRs approved out of fatigue | **Small-PR directive**: above 30 files (configurable) the agent proposes incremental PRs |
| "Works on my machine" | **Gates** in git hooks and a generated GitHub Actions workflow |
| Docs that rot | **Doc-sync** checks: C4, ADRs and tracks updated in the same task |

## Install in 60 seconds

```bash
npm i -D aquila-react-ai
npx aquila-react-ai init
```

Then ask your agent for **`/aquila-init`**. It reads your codebase, confirms six choices with you and writes
the documentation the agents will rely on. That's it: `/aquila-plan` is ready.

## What lands in your project

`init` scaffolds the full AI structure, versioned with your code so teammates **and cloud agents** get it
on clone:

```text
your-react-app/
├── .aquila/                         ← the method (rules, roles, skills, React conventions) — synced from the package
│   ├── core/  skills/  agents/  adapters/  schema/  .claude-plugin/
├── docs/
│   ├── ai/  CONTEXT.md · golden.md · aquila.json · skills/     ← what agents must know about YOUR project
│   ├── c4/  adr/  tracks/  reference/  runbooks/
├── .github/
│   ├── instructions/*.instructions.md                         ← per-folder rules (native in Copilot)
│   ├── copilot-instructions.md
│   └── workflows/aquila-gates.yml                             ← CI gates, generated
├── .aquila-hooks/                                            ← git hook dispatcher, shared by every aquila package
├── AGENTS.md  ·  CLAUDE.md                                    ← tiny routers every agent reads first
└── .claude/commands/aquila-*.md                               ← slash-command shortcuts
```

## One method, three agents

```mermaid
flowchart LR
    CFG["docs/ai/aquila.json<br/>(single source of truth)"] --> SYNC(["npx aquila-react-ai sync"])
    PKG[["aquila-react-ai package"]] --> SYNC
    SYNC --> M[".aquila/<br/>method"]
    SYNC --> A["AGENTS.md"]
    SYNC --> C["CLAUDE.md<br/>+ plugin + /commands"]
    SYNC --> G[".github/copilot-instructions.md<br/>+ agents + skills"]
    SYNC --> W["aquila-gates.yml"]
    A --> CODEX(("OpenAI<br/>Codex"))
    C --> CLAUDE(("Claude<br/>Code"))
    G --> COPILOT(("GitHub<br/>Copilot"))
    M -.read on demand.-> CODEX & CLAUDE & COPILOT
```

| | Claude Code | GitHub Copilot | OpenAI Codex |
|---|---|---|---|
| Entry point | `CLAUDE.md` → `AGENTS.md` | `copilot-instructions.md` + `AGENTS.md` | `AGENTS.md` |
| `/aquila-*` commands | ✅ plugin skills + shortcuts | ✅ `chat.agentSkillsLocations` | ✅ "aquila-plan …" |
| Roles (plan/tests/implement/review) | ✅ plugin agents | ✅ custom agents with handoffs | ✅ read as files |
| Per-folder rules | ✅ via the context map | ✅ native `.instructions.md` (also PR review) | ✅ via the context map |
| Guard against `--no-verify` / force push | ✅ PreToolUse hook | — (git hooks still apply) | — (git hooks still apply) |

## The methodology

### 1. Spec-Driven Development → Test-Driven Development

```mermaid
flowchart LR
    R([Request / ticket]) --> P["/aquila-plan<br/>spec.md + plan.md"]
    P --> H{"You:<br/>plan approved?"}
    H -- adjust --> P
    H -- yes --> T["aquila-tests<br/>failing tests"]
    T --> I["aquila-implement<br/>minimal code"]
    I --> G{"gate ci<br/>green?"}
    G -- no --> I
    G -- yes --> V["aquila-review<br/>diff review"]
    V --> D([You commit])
```

**Why it works for AI:** models are excellent at following a precise contract and poor at guessing intent.
The plan is that contract (scope, files, test strategy, docs to update), and the human checkpoint stops the
most expensive failure mode: confidently building the wrong thing. Failing tests first give the agent an
objective "done" signal instead of its own opinion.

### 2. Four specialised roles

| Role | Job | Never does |
|---|---|---|
| `aquila-plan` | Turns a request into a self-contained plan | Write production code |
| `aquila-tests` | Writes the failing tests from the plan's cases | Touch the implementation |
| `aquila-implement` | Minimal code to make tests pass, golden-file style | Expand scope |
| `aquila-review` | Ranked findings: correctness, layers, tests, docs, React, a11y, PR size | Approve its own work |

Separating roles keeps each prompt small and focused, and the reviewer judges the diff, not the intent.

### 3. React conventions, version-aware

Agents read the project's **installed React major** (it's stamped into `AGENTS.md`) and apply
[`core/react.md`](core/react.md): feature folders, pure components, Rules of Hooks and "you might not need
an effect", server data in the data library (TanStack Query, SWR, loaders), forms with schema validation,
loading / error / empty states, no secrets in the bundle, XSS and token-storage basics, accessibility
(WCAG 2.2 AA), testing with Testing Library + MSW + Playwright. Version notes cover the changes that trip
agents up — `createRoot` and StrictMode remounts in 18, Actions, `ref` as a prop and removed APIs in 19,
`useEffectEvent` and `<Activity>` in 19.2, `<ViewTransition>` and Fragment refs in 19.3, React Compiler on or off — so the agent **never uses an API newer
than your project**.

### 4. Golden files and a context map

Instead of long style guides, `docs/ai/golden.md` points to one exemplary file per type (page,
form, custom hook, component test…). Agents copy proven patterns from **your** codebase. `docs/ai/CONTEXT.md` is a map: the
agent opens only the section a task needs, and **code always beats docs** when they disagree.

### 5. Quality gates, everywhere

```mermaid
flowchart LR
    E["edit"] --> PC["pre-commit<br/>format · lint"]
    PC --> PP["pre-push<br/>typecheck · test · lint-aquila"]
    PP --> CI["CI · aquila-gates.yml<br/>all gates + check"]
```

Gates are detected from your `package.json` scripts (`typecheck`, `test`, `lint`, `format:check`,
`test:cov`, `build`, `test:e2e`) — no new tooling to learn. On top, **lint levels** (`off` / `standard` / `high`) add a
catalog of principles, each mapped to its Sonar rule and enforced with ESLint — including Rules of Hooks,
exhaustive deps, list keys, no `dangerouslySetInnerHTML` and `jsx-a11y` basics.

### 6. Token economy

What every agent loads on **every** prompt is capped; everything else is read on demand. These are the
default budgets `npx aquila-react-ai check` enforces (characters):

```mermaid
xychart-beta
    title "Default context budgets (chars) — enforced in CI"
    x-axis ["AGENTS.md", "per-folder rule", "golden.md", "copilot-instr.", "project skill", "CONTEXT.md"]
    y-axis "max characters" 0 --> 15000
    bar [3500, 2500, 6000, 8000, 10000, 14500]
```

Before any task that reads the whole codebase, agents run `npx aquila-react-ai tokens` and **ask for approval**
when it would exceed 20 % of your monthly limit.

### 7. Small PRs by design

PRs above `review.prMaxFiles` changed files (**30** by default, set at `init`) get split: the plan proposes
increments, and the review flags oversized diffs with a concrete split (by layer, feature folder or plan step).
Reviewable PRs mean real reviews — not rubber stamps.

## Commands

### Agent commands

Claude Code and Copilot: `/aquila-…` · Codex: "aquila-plan …".

| Command | What it does |
|---|---|
| `/aquila-init` | Sets up config, docs, CI, hooks and agents from the current state |
| `/aquila-plan` | Request → `spec.md` + `plan.md`, then stops for approval |
| `/aquila-execute` | Runs an approved plan: failing tests → code → gates → review |
| `/aquila-review` | Reviews a diff/PR (also code not written by the agent) |
| `/aquila-docs` | Generates/updates `CONTEXT.md`, golden files, per-folder rules, C4 |
| `/aquila-adr` · `/aquila-c4` · `/aquila-guideline` | Decisions, architecture diagrams, multi-ticket tracks |
| `/aquila-test-comment` | "How to test" steps for QA |
| `/aquila-audit` · `/aquila-deep-audit` | Method adoption audit · deep product audit (security, contracts, errors…) |
| `/aquila-config` · `/aquila-doctor` | Change settings · diagnose and fix the install |

### CLI

| Command | What it does |
|---|---|
| `npx aquila-react-ai init [flags]` | Install: config, templates, `.aquila/`, adapters, CI workflow, hooks |
| `npx aquila-react-ai sync` | Regenerate `.aquila/`, routers, settings and CI from `aquila.json` |
| `npx aquila-react-ai check [--ready] [--verbose]` | Schema, links, budgets, drift, hooks/CI location · strict local readiness |
| `npx aquila-react-ai gate <pre-commit\|pre-push\|ci>` | Run a phase's gates; prints only failures |
| `npx aquila-react-ai doctor` | Installation diagnostics |
| `npx aquila-react-ai lint [rules|matrix] [--fix] [--baseline]` | ESLint at the configured level · rule status · fixes · legacy baseline |\|matrix]` | ESLint at the configured level · rule status |
| `npx aquila-react-ai tokens [paths…]` | Estimate tokens to read a scope |

`init` flags: `--lang=en|pt-BR|pt-PT` · `--tools=copilot,claude,codex` · `--token-limit=<n>|none` ·
`--mode=local|team` · `--lint=off|standard|high` · `--pr-max-files=<n>` · `--code-lang=…` (default: detected) ·
`--hooks=dispatcher` · `--install` (lint plugins). Every command takes `--help`.

### Claude Code plugin

```bash
claude plugin marketplace add ./.aquila
claude plugin install aquila@aquila-react-ai --scope local
```

(`--scope project` in team mode.) `npx aquila-react-ai doctor` reminds you if it's missing.

## `local` vs `team` mode

| | `local` | `team` |
|---|---|---|
| `.aquila/`, docs, config, CI | versioned | versioned |
| Routers (`AGENTS.md`, `CLAUDE.md`, Copilot) and settings | generated per machine | versioned — cloud agents and AI PR review get them |
| New teammate | `npm install && npx aquila-react-ai init` | same (hooks are per clone) |

<!-- aquila-monorepo:start -->
## Monorepo / project in a subfolder

aquila-react-ai works when the React project is not the repository root (`repo/backend`, `repo/apps/web`…) and next
to the other aquila packages (e.g. `repo/backend` with aquila-ai + `repo/frontend` with aquila-react-ai). Run
`npm i -D aquila-react-ai` and `npx aquila-react-ai init` **inside the project folder**; everything git, GitHub and Copilot read
is written at the repository root:

```text
repo/
├── .aquila-hooks/            ← one hook dispatcher for the whole repo (core.hooksPath = .aquila-hooks)
│   ├── pre-commit  pre-push  ← same bytes in every aquila package, versioned 100755
│   └── projects              ← "aquila-ai backend" / "aquila-react-ai frontend" — one line per project
├── .github/
│   ├── workflows/aquila-gates-backend.yml       ← per project: working-directory, paths: backend/**
│   └── instructions/aquila-backend.instructions.md ← Copilot rules scoped to backend/** (applyTo)
├── backend/                  ← NestJS + aquila-ai (.aquila/, docs/, AGENTS.md…)
└── frontend/                 ← React + aquila-react-ai
```

- **Hooks:** a repository has one `core.hooksPath`, so every aquila package writes the same dispatcher
  (`# aquila-hooks v2`; a package never downgrades a newer one). On `pre-commit` it runs `<package> gate
  pre-commit` only in projects with staged files; on `pre-push`, only in projects touched by the pushed commits —
  with the package found in the project's `node_modules` or hoisted to the root (npm/pnpm workspaces).
- **Executable bit:** `init` records the hooks as `100755` in the index (Windows does not); `check` fails when
  they are versioned `100644`, which Linux/macOS clones would never run.
- **CI:** GitHub reads `.github/workflows` only at the root: each project gets `aquila-gates-<folder>.yml`
  there. Tests that need a database? Declare `ci.services` (e.g. `postgres:16`) and `ci.env`. Already have a
  pipeline? `ci.workflow: false` — `doctor` prints the two steps to add to it.
- **Done ≠ CI:** `done.gates` lists what the agent must leave green, independent of `hooks.ci`.
- **Husky or another manager?** `init` keeps it and tells you to call
  `"$(git rev-parse --show-toplevel)/.aquila-hooks/pre-commit"` (and `pre-push "$@"`) from it, or migrates with
  `init --hooks=dispatcher`. A `core.hooksPath` whose folder is gone or has no hooks is migrated with a warning.
- **Claude Code:** each project enables its own plugin in its `.claude/settings.json`: open the session in the
  project folder.
- **Verify:** `npx aquila-react-ai doctor` (subfolder, dispatcher, registered projects, bin found, workflow) and
  `npx aquila-react-ai check` (fails when hooks or the workflow sit where git/GitHub never read them).

Upgrading: upgrade **all** aquila packages of the repository to the same minor, then run `init` in each
project and commit `.aquila-hooks/` and the workflows.
<!-- aquila-monorepo:end -->

<!-- aquila-legacy:start -->
## Adopting in a legacy project

`init` reads what the project already has before proposing anything:

- **Gates:** a check-only script (`lint:check`, `lint:ci`, `format:check`…) is preferred; a script that fixes
  files (`--fix`, `--write`) never becomes a gate — in a hook it would change files mid-commit.
- **Coverage:** the thresholds already in `jest.config` / `vite.config` / `vitest.config` are used, not aquila's
  default. With a `coverage` gate, CI does not also run `test` (the suite would run twice).
- **Language:** the identifiers' language is detected (`language.code`; `--code-lang=…` to choose), and
  `--lang=pt-BR|pt-PT` writes the `docs/` indexes in that language.
- **Lint plugins:** at `--lint=high`, `init` prints the exact `npm i -D …` with versions that work together
  (or installs them with `--install`); `doctor` checks the installed versions. They are optional
  `peerDependencies` of aquila-react-ai.

Then, so existing violations don't block every commit:

```sh
npx aquila-react-ai lint --baseline   # records today's violations in docs/ai/lint-baseline.json — commit it
```

From then on `lint-aquila` fails only on **new** violations (ESLint bulk suppressions, ESLint ≥ 9.24); run
`--baseline` again after fixing to shrink the file. Rules that clash with the project are tuned per rule
instead of lowering the whole level:

```json
"lint": { "level": "high", "overrides": { "curly": "off", "max-lines-per-function": ["error", { "max": 120 }] } }
```

A standing instruction like "commit after every change" goes in `workflow.autoCommit: true`, so the generated
`AGENTS.md` doesn't contradict it.
<!-- aquila-legacy:end -->

## Updating

```bash
npm i -D aquila-react-ai@latest
npx aquila-react-ai sync
npx aquila-react-ai check
```

`sync` refreshes `.aquila/`; review and commit the diff. CI fails if `.aquila/` drifts from the installed
version, so the team always runs the same method.

## Requirements and limits

Node ≥ 22, Git, a React project (Vite, Next.js, React Router, CRA…). One aquila package per project
root (folder): `init`/`sync` stop if `.aquila/` already belongs to another aquila package instead of
overwriting it — put each project in its own folder ([Monorepo](#monorepo--project-in-a-subfolder)). Zero runtime dependencies. aquila-react-ai guides and automates checks; it does
not guarantee defect-free code or that every model obeys every rule — that's why the human checkpoint and the
gates exist.


## Sibling packages

The same method, one package per stack — they share the hook dispatcher and coexist in one repository:

| Package | Stack |
|---|---|
| [`aquila-ai`](https://www.npmjs.com/package/aquila-ai) | NestJS (backend) |
| [`aquila-react-ai`](https://www.npmjs.com/package/aquila-react-ai) | React (Vite, React Router, CRA…) |
| [`aquila-next-ai`](https://www.npmjs.com/package/aquila-next-ai) | Next.js |

## Contributing

See [`AGENTS.md`](AGENTS.md) and [`core/contributing.md`](core/contributing.md). Tests: `npm test`.
Releases: push a `vX.Y.Z` tag matching `package.json` and `.claude-plugin/plugin.json`; the release workflow
publishes to npm.

## License

[MIT](LICENSE) © Aquila Zimbrao
