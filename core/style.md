# Style

- **Language**: `docs/ai/aquila.json` → `language` (`code`, `docs`, `answers`; default `en` for all) —
  the generated `AGENTS.md` repeats it (other values: `pt-BR`, `pt-PT`, …). Always talk to the dev in the
  `answers` language, without mixing variants (`pt-PT` ≠ `pt-BR`). aquila-react-ai's own texts are in English;
  what the agent writes follows the project's `language`.
- **Comments**: none by default. When the "why" is not obvious, a short JSDoc on the declaration. No
  comments that restate the code, no commented-out code.
- **Simplicity**: reuse the existing helper/pattern before writing one; the smallest change all callers go
  through; no speculative abstractions.
- **Errors**: logged **and** rethrown — never swallowed.
- **Configuration** only through the project's config mechanism (never ad-hoc environment variable reads).
- **Secrets** never in code, examples, logs or docs.
- **Output to the dev**: concise; what changed, what was verified, risks to review before merge.
