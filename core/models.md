# Models per role

Each role and skill has a model level in [`../adapters/models.json`](../adapters/models.json). A weak model in
a `deep` role produces shallow plans and wrong root causes; a strong model on a `light` task only spends tokens.

| Level | For | Claude |
|---|---|---|
| `deep` | root cause, design, contracts across tickets, risk audit (`aquila-plan`, `aquila-guideline`, `aquila-deep-audit`) | opus |
| `standard` | work driven by a plan or checklist: tests, code, review, docs, init/config | sonnet |
| `light` | short, mechanical task: CLI diagnosis, template text (`aquila-doctor`, `aquila-test-comment`) | haiku |

- **Claude Code** applies it on its own (`model:` in the agent and skill frontmatter).
- **Copilot, Codex and phases run in the same session** (no subagents): before starting the phase, check that
  the session's model is of the role's level; if not, **tell the dev** which one is recommended and let them
  decide — never switch models on your own.
- Going up a level is legitimate on a risky PR (security, data, money): `aquila-review` with the `deep`
  model. Going down a level in a `deep` role is not.
- `aquila-execute`, `aquila-init` and `aquila-config` are `disable-model-invocation`: the model never picks
  them by itself (they change code or the setup); the dev runs them, or the agent follows their `SKILL.md`
  when the dev asks for it (`plan approved`, "set up aquila").
- Changing a level: edit only `models.json` and align the frontmatters (`test/models.test.mjs` fails when they
  diverge).
