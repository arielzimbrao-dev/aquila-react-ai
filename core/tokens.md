# Token economy

Quality and cost go together: too much context dilutes the rules that matter.

## High-consumption warning

Before a task that reads the whole codebase (`aquila-docs`, `aquila-audit`, `aquila-deep-audit`, `aquila-c4`
from scratch, "analyze/document the repo"), estimate the cost with the CLI (cheap: file sizes only),
passing the in-scope folders, or nothing for the whole repo:

```bash
npx aquila-react-ai tokens [folders…]
```

Compare with the dev's monthly limit (`docs/ai/aquila.local.json` → `tokenLimit`, set in `aquila-init` /
`aquila-config`). If the output has `! ALERT` (more than **20%** of the limit), **stop and ask for approval**:

> ⚠️ This command should consume ~N tokens (X% of your monthly limit of L). Proceed with everything, or
> limit it to `<part>` (e.g. `context`, `c4`, one folder)?

Proceed only on a "yes" or with the chosen scope (rerun `tokens` for the new scope). Below 20%, or with
**no limit set** (the dev chose not to have one), proceed without asking. If the dev already approved this
scope in this conversation, do not ask again.

## Rules

- **Always loaded, small**: the root routers (`check` budgets: `AGENTS.md` 3,500 characters,
  `copilot-instructions.md` 8,000; each chain of `AGENTS.md` from the repository root down to a folder
  ≤ 32 KiB, Codex's cut) and the skill/agent descriptions (short). Everything else is read on demand.
  Maintenance notes go in HTML comments (`<!-- … -->`): Claude Code strips them from the context.
- **Model per role** ([models](models.md)): `aquila-review` runs on the `standard` model by default; on a
  risky PR (security, data, money) ask for the review with the `deep` one.
- **Locate before reading**: `docs/ai/CONTEXT.md` map → `git ls-files`/`grep -l` → open only what the
  change touches, by line range when the file is large. Never reread a file already read.
- **Large docs by section**: "open only §"; never the whole file (`CONTEXT.md` lists which ones).
- **Wide sweeps in a subagent** (Explore/read-only, cheaper model when the tool allows): only the
  conclusion returns to the main context, not the files.
- **Inventory by metadata**: path, size and first heading (`head -5`) before opening content.
- **Skills with progressive loading**: short `SKILL.md` + `references/` opened only when needed.
- **Short tool output**: while iterating, run only the touched tests, in quiet mode; `aquila-react-ai gate`
  prints only failures and totals; the full suite runs once, at the end.
- **Budgets checked in CI** (`docs/ai/aquila.json` → `budgets`): routers, context, skills, instructions,
  agents. Over the cap → move the detail to `references/` or `docs/`.
- **Answers**: what changed, what was verified, what is missing. No file or log dumps.
