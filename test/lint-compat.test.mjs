// 0.4.0: the project's own ESLint and aquila's rules (aquilaEslintCompat), rules that are never autofixed,
// and the production/test split when tests live next to the code. Pure: fake plugins, no ESLint install.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { pathToFileURL } from 'node:url';
import { PKG } from './helpers.mjs';

const load = (rel) => import(pathToFileURL(join(PKG, rel)).href);
const catalog = JSON.parse(readFileSync(join(PKG, 'lint/rules.json'), 'utf8'));

test('aquilaEslintCompat: drops "not found" and "unused directive" only for aquila rules', async () => {
  const { aquilaEslintCompat } = await load('lint/eslint/compat.mjs');
  const block = aquilaEslintCompat();
  assert.ok(block.files.length && block.processor, 'one block with a processor');
  const unused = (rule) => ({ ruleId: null, message: `Unused eslint-disable directive (no problems were reported from '${rule}').` });
  const messages = [
    { ruleId: 'sonarjs/pseudo-random', message: "Definition for rule 'sonarjs/pseudo-random' was not found." },
    unused('sonarjs/pseudo-random'),
    unused('max-lines-per-function'),
    unused('aquila/max-params'),
    unused('someplugin/not-aquila'),
    { ruleId: 'sonarjs/pseudo-random', message: 'Make sure that using this pseudorandom number generator is safe here.' },
  ];
  const kept = block.processor.postprocess([messages]);
  assert.deepEqual(kept, [messages[4], messages[5]], 'a stale directive of another rule and real problems stay');
  assert.deepEqual(block.processor.preprocess('const a = 1;'), ['const a = 1;']);
  assert.equal(block.processor.supportsAutofix, true, "the project's --fix still applies");
});

test('a catalog rule with "fix": false reports with a suggestion instead of an autofix', async () => {
  const { buildEslintConfig } = await load('lint/eslint/build.mjs');
  const fixable = catalog.rules.flatMap((r) => r.enforce?.eslint ?? []).filter((e) => e.fix === false);
  assert.ok(fixable.some((e) => e.rule === 'unicorn/prefer-at'), 'unicorn/prefer-at is never autofixed');
  const reports = [];
  const prefersAt = {
    meta: { type: 'suggestion', fixable: 'code', schema: [] },
    create: (context) => ({ Program: (node) => context.report({ node, message: 'Prefer .at()', fix: () => 'FIX' }) }),
  };
  const { config } = buildEslintConfig(catalog, { level: 'high', srcDirs: ['src'], plugins: { unicorn: { rules: { 'prefer-at': prefersAt } } } });
  const rule = config.find((b) => b.plugins?.unicorn).plugins.unicorn.rules['prefer-at'];
  assert.equal(rule.meta.hasSuggestions, true);
  rule.create({ options: [], report: (d) => reports.push(d) }).Program({});
  assert.equal(reports[0].fix, undefined);
  assert.equal(reports[0].suggest[0].fix(), 'FIX');
});

test('srcDirs = testDirs = src: production blocks ignore test files, test blocks never cover all of src', async () => {
  const { buildEslintConfig } = await load('lint/eslint/build.mjs');
  const testOnly = new Set(catalog.rules.flatMap((r) => r.enforce?.eslint ?? []).filter((e) => e.files === 'test').map((e) => e.rule));
  const fake = (prefix) => ({ rules: Object.fromEntries([...testOnly].filter((r) => r.startsWith(prefix + '/')).map((r) => [r.split('/').pop(), { create: () => ({}) }])) });
  const plugins = Object.fromEntries([...new Set([...testOnly].filter((r) => r.includes('/')).map((r) => r.split('/')[0]))].map((p) => [p, fake(p)]));
  const { config } = buildEslintConfig(catalog, { level: 'high', srcDirs: ['src'], testDirs: ['src'], plugins });
  const srcOnly = config.filter((b) => b.rules && Object.keys(b.rules).includes('max-lines-per-function'));
  assert.ok(srcOnly.length);
  for (const b of srcOnly) assert.ok(b.ignores?.some((g) => g.includes('test')), JSON.stringify(b.files));
  // Test-only rules (catalog files: test) never reach a block that covers all of src.
  const wide = config.filter((b) => b.files?.includes('src/**/*.{ts,tsx,mts,cts,js,jsx,mjs,cjs}') && b.rules);
  for (const b of wide) assert.deepEqual(Object.keys(b.rules).filter((r) => testOnly.has(r)), [], JSON.stringify(b.files));
  const testBlock = config.find((b) => b.rules && Object.keys(b.rules).some((r) => testOnly.has(r)));
  assert.ok(testBlock && !testBlock.files.some((f) => f.startsWith('src/**')), JSON.stringify(testBlock?.files));
});
