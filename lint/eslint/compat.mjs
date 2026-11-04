// For the PROJECT's own eslint.config: makes `eslint-disable` directives for rules only `aquila-react-ai lint` runs
// harmless there. Without it the project's ESLint fails with "Definition for rule '…' was not found" (plugin
// only aquila loads) and, with reportUnusedDisableDirectives, reports them as unused — `--fix` deletes them.
//   import { aquilaEslintCompat } from 'aquila-react-ai/lint/eslint/compat.mjs';
//   export default [...yourConfig, aquilaEslintCompat()];
// Only those two directive messages are dropped, and only for catalog rules (lint/rules.json, any level):
// the project's own problems, fixes and stale directives of its other rules stay.
import { readFileSync } from 'node:fs';

const catalog = JSON.parse(readFileSync(new URL('../rules.json', import.meta.url), 'utf8'));
const entries = catalog.rules.flatMap((r) => r.enforce?.eslint ?? []);
const RULES = new Set([...entries.map((e) => e.rule).filter(Boolean)]);
// A preset (e.g. sonarjs/recommended) brings every rule of its plugin.
const PREFIXES = ['aquila/', ...entries.filter((e) => e.preset).map((e) => `${e.preset.split('/')[0]}/`)];
const isAquila = (rule) => RULES.has(rule) || PREFIXES.some((prefix) => rule.startsWith(prefix));

const NOT_FOUND = /^Definition for rule '([^']+)' was not found/;
const UNUSED = /^Unused eslint-[\w-]+ directive \(.*'([^']+)'\)/;

const directiveRule = (m) => (m.ruleId ? NOT_FOUND.exec(m.message)?.[1] : UNUSED.exec(m.message)?.[1]);

export const aquilaCompatProcessor = {
  meta: { name: 'aquila-react-ai/compat' },
  supportsAutofix: true,
  preprocess: (text) => [text],
  postprocess: (lists) =>
    lists.flat().filter((m) => {
      const rule = directiveRule(m);
      return !(rule && isAquila(rule));
    }),
};

/** One flat-config block; put it last so no later block replaces its processor. */
export function aquilaEslintCompat({ files = ['**/*.{ts,tsx,mts,cts,js,jsx,mjs,cjs}'] } = {}) {
  return { name: 'aquila-react-ai/compat', files, processor: aquilaCompatProcessor };
}
