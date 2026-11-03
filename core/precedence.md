# Precedence

Single copy of the precedence chain; other files point here. When sources disagree:

1. explicit user instruction;
2. the project's **real code**;
3. the project's doc for the topic (`docs/**`: C4, ADR, track, `docs/ai/CONTEXT.md`);
4. `.aquila/core/**`;
5. generated adapters (`AGENTS.md`, `CLAUDE.md`, `.github/copilot-instructions.md`, …);
6. ephemeral files (`spec.md`, `plan.md`).

A disagreement is a documentation bug: fix the lower source in the same task. Within a track, the track
contract beats the ticket text ([tracks](tracks.md)).
