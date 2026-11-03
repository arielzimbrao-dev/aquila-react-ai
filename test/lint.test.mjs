import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { pathToFileURL } from 'node:url';
import { PKG, CLI, project, aquila, readIn, editConfig, cleanup } from './helpers.mjs';

test('lint: levels off ⊂ standard ⊂ high, gate and line in AGENTS.md', async () => {
  const { lintRules } = await import(pathToFileURL(CLI).href);
  const standard = lintRules('standard').map((r) => r.id);
  const high = lintRules('high').map((r) => r.id);
  assert.equal(lintRules('off').length, 0);
  assert.ok(standard.length > 0 && high.length > standard.length);
  assert.ok(
    standard.every((id) => high.includes(id)),
    'standard ⊂ high',
  );

  const root = project({ 'node_modules/eslint/bin/eslint.js': '' });
  try {
    aquila(root, 'init', '--lint=high');
    const cfg = JSON.parse(readIn(root, 'docs/ai/aquila.json'));
    assert.deepEqual(cfg.lint.level, 'high');
    assert.equal(cfg.lint.pending, undefined, 'engine installed');
    assert.match(aquila(root, 'doctor').out, /engine available.*lint rules.*lint matrix/);
    assert.equal(cfg.gates['lint-aquila'], 'npx aquila-react-ai lint');
    assert.ok(cfg.hooks.ci.includes('lint-aquila'));
    assert.match(readIn(root, 'AGENTS.md'), /Quality \(lint `high`\)/);
    const rules = aquila(root, 'lint', 'rules');
    assert.match(rules.out, /level high \(\d+;/);
    assert.match(rules.out, /AQ-FN-01 \[Sonar S138\]/);
    assert.match(aquila(root, 'lint', 'rules', '--level=standard').out, /^(?!.*AQ-FN-01)/s);

    editConfig(root, (c) => (c.lint.level = 'off'));
    assert.match(aquila(root, 'sync').out, /lint off — lint-aquila removed from gates/);
    assert.doesNotMatch(readIn(root, 'AGENTS.md'), /Quality/);
    assert.match(aquila(root, 'lint').out, /lint off \(docs\/ai\/aquila\.json/);
    const off = JSON.parse(readIn(root, 'docs/ai/aquila.json'));
    assert.equal(off.gates['lint-aquila'], undefined, 'off removes the gate');
    assert.ok(!Object.values(off.hooks).flat().includes('lint-aquila'));

    editConfig(root, (c) => (c.lint.level = 'standard'));
    assert.match(aquila(root, 'sync').out, /lint standard — lint-aquila in pre-push and ci/);
    assert.ok(JSON.parse(readIn(root, 'docs/ai/aquila.json')).hooks.ci.includes('lint-aquila'));
    assert.doesNotMatch(aquila(root, 'sync').out, /lint-aquila/, 'idempotent');

    editConfig(root, (c) => (c.lint.level = 'max'));
    assert.match(aquila(root, 'check').out, /lint\.level: "max" is not "off" \| "standard" \| "high"/);
  } finally {
    cleanup(root);
  }
});

test('lint rules reports missing plugins, partial coverage and the catalog matrix', () => {
  const root = project({ 'node_modules/eslint/bin/eslint.js': '' });
  try {
    aquila(root, 'init', '--tools=codex', '--lint=high');
    const absent = aquila(root, 'lint', 'rules');
    assert.equal(absent.code, 0, absent.out);
    assert.match(absent.out, /AQ-TYP-01.*no active rule: missing.*typescript-eslint/);
    assert.match(absent.out, /AQ-LOG-01.*\(configured\)/);
    assert.match(absent.out, /AQ-API-01.*partial.*unicorn/);
    assert.match(absent.out, /AQ-TST-05.*review\/Sonar/);
    assert.match(absent.out, /does not confirm execution or semantic coverage/);
    const matrix = aquila(root, 'lint', 'matrix', '--level=standard');
    assert.equal(matrix.code, 0, matrix.out);
    assert.match(matrix.out, /^\| Rule \| ESLint \(required plugins\) \|$/m);
    assert.match(matrix.out, /^\| AQ-TYP-01 \| typescript-eslint \|$/m);
    const catalog = JSON.parse(readFileSync(join(PKG, 'lint/rules.json'), 'utf8'));
    assert.deepEqual(
      matrix.out
        .split('\n')
        .filter((line) => line.startsWith('| AQ-'))
        .map((line) => line.split('|')[1].trim()),
      catalog.rules.filter((rule) => rule.level === 'standard').map((rule) => rule.id),
      'each selected rule appears exactly once, in catalog order',
    );
    assert.doesNotMatch(matrix.out, /AQ-FN-01/);
    assert.match(aquila(root, 'lint', 'matrix', '--level=off').out, /no rules/);
    const bad = aquila(root, 'lint', 'rules', '--level=max');
    assert.equal(bad.code, 1);
    assert.match(bad.out, /--level.*off.*standard.*high/);
    assert.equal(aquila(root, 'lint', 'matrx').code, 1);
  } finally {
    cleanup(root);
  }
});

test('lint rules loads project plugins and surfaces import failures', () => {
  const root = project({
    'node_modules/eslint/bin/eslint.js': '',
    'node_modules/eslint-plugin-unicorn/package.json': JSON.stringify({
      name: 'eslint-plugin-unicorn',
      type: 'module',
      main: 'index.js',
    }),
    'node_modules/eslint-plugin-unicorn/index.js': 'export default { rules: {} };\n',
  });
  try {
    aquila(root, 'init', '--tools=codex', '--lint=high');
    const available = aquila(root, 'lint', 'rules');
    assert.equal(available.code, 0, available.out);
    assert.match(available.out, /AQ-API-01.*\(configured\)/);
    writeFileSync(
      join(root, 'node_modules/eslint-plugin-unicorn/index.js'),
      "throw new Error('broken plugin');\n",
    );
    const broken = aquila(root, 'lint', 'rules');
    assert.equal(broken.code, 1, broken.out);
    assert.match(broken.out, /could not load eslint-plugin-unicorn.*broken plugin/);
  } finally {
    cleanup(root);
  }
});

test('lint: engine installed after init → sync adds lint-aquila to the gates', () => {
  const root = project();
  try {
    aquila(root, 'init', '--lint=standard');
    assert.match(JSON.parse(readIn(root, 'docs/ai/aquila.json')).lint.pending, /ESLint/);
    mkdirSync(join(root, 'node_modules/eslint/bin'), { recursive: true });
    writeFileSync(join(root, 'node_modules/eslint/bin/eslint.js'), '');
    assert.match(aquila(root, 'sync').out, /lint-aquila in pre-push and ci/);
    const cfg = JSON.parse(readIn(root, 'docs/ai/aquila.json'));
    assert.equal(cfg.lint.pending, undefined);
    assert.ok(cfg.hooks.ci.includes('lint-aquila') && cfg.hooks['pre-push'].includes('lint-aquila'));
    assert.doesNotMatch(aquila(root, 'sync').out, /lint-aquila/, 'idempotent');
  } finally {
    cleanup(root);
  }
});

test('lint: ESLint builder applies the level and scopes, and skips missing plugins', async () => {
  const { buildEslintConfig } = await import(
    pathToFileURL(join(PKG, 'lint/eslint/build.mjs')).href
  );
  const catalog = JSON.parse(readFileSync(join(PKG, 'lint/rules.json'), 'utf8'));
  const rulesOf = (config) =>
    Object.assign({}, ...config.filter((c) => c.rules).map((c) => c.rules));
  const opts = { srcDirs: ['src'], root: '/r', plugins: {} };

  const off = buildEslintConfig(catalog, { ...opts, level: 'off' });
  assert.deepEqual(rulesOf(off.config), {});

  const std = buildEslintConfig(catalog, { ...opts, level: 'standard' });
  assert.deepEqual(rulesOf(std.config).eqeqeq, ['error', 'always']);
  assert.equal(rulesOf(std.config)['max-depth'], undefined, 'max-depth only in high');
  assert.ok(
    std.missing.includes('typescript-eslint'),
    'a rule with a missing plugin is skipped and reported',
  );

  const high = buildEslintConfig(catalog, { ...opts, level: 'high', ticketPattern: 'DGT-\\d+' });
  assert.deepEqual(
    high.coverage.find((rule) => rule.id === 'AQ-API-01'),
    {
      id: 'AQ-API-01',
      configured: 2,
      total: 6,
      pending: ['unicorn'],
    },
  );
  const depth = high.config.find((c) => c.rules?.['max-depth']);
  assert.deepEqual(depth.rules['max-depth'], ['error', 3]);
  assert.deepEqual(depth.files, ['src/**/*.{ts,tsx,mts,cts,js,jsx,mjs,cjs}'], 'src only');
  assert.deepEqual(depth.ignores, ['**/*.stories.*'], 'stories excluded from function size');
  assert.deepEqual(rulesOf(high.config)['aquila/max-params'], ['error', 5]);
  const title = rulesOf(high.config)['jest/valid-title'];
  assert.equal(title, undefined, 'jest missing → rule skipped');
  const withJest = buildEslintConfig(catalog, {
    ...opts,
    level: 'high',
    ticketPattern: 'DGT-\\d+',
    plugins: { jest: {} },
  });
  assert.deepEqual(rulesOf(withJest.config)['jest/valid-title'][1].mustNotMatch[0], 'DGT-\\d+');

  const ts = buildEslintConfig(catalog, {
    ...opts,
    level: 'standard',
    plugins: { 'typescript-eslint': { plugin: {}, parser: {} } },
  });
  assert.ok(
    ts.config.every((c) => !c.files || c.files.every((f) => !f.includes('js,'))),
    'TS project: .ts only',
  );
});

test('lint: local rules max-params (constructors excluded) and config-only-env', async () => {
  const { aquilaPlugin } = await import(pathToFileURL(join(PKG, 'lint/eslint/build.mjs')).href);
  const reports = [];
  const ctx = (options, filename, settings = {}) => ({
    options,
    filename,
    settings,
    report: (r) => reports.push(r),
  });
  const fn = (n, kind) => ({
    params: Array(n).fill({}),
    parent: kind ? { type: 'MethodDefinition', kind } : null,
  });

  const maxParams = aquilaPlugin.rules['max-params'].create(ctx([2]));
  maxParams.FunctionExpression(fn(3, 'constructor'));
  maxParams.FunctionExpression(fn(3, 'method'));
  maxParams.ArrowFunctionExpression(fn(2));
  assert.equal(reports.length, 1);

  const settings = { aquila: { root: 'C:\\p', configPaths: ['**/config/**'] } };
  const visitor = (file) => aquilaPlugin.rules['config-only-env'].create(ctx([], file, settings));
  assert.deepEqual(visitor('C:\\p\\src\\config\\app.ts'), {});
  const sel = "MemberExpression[object.name='process'][property.name='env']";
  visitor('C:\\p\\src\\orders\\OrderList.tsx')[sel]({});
  assert.equal(reports.length, 2);
  visitor('C:\\p\\src\\orders\\OrderList.tsx')[
    "MemberExpression[object.type='MetaProperty'][property.name='env']"
  ]({});
  assert.equal(reports.length, 3, 'import.meta.env (Vite) is also config-only');
});

test('lint: a missing engine gives an actionable message instead of an npx error', () => {
  const root = project();
  try {
    aquila(root, 'init');
    const r = aquila(root, 'lint');
    assert.equal(r.code, 1);
    assert.match(r.out, /ESLint is not installed in the project — npm i -D eslint/);
  } finally {
    cleanup(root);
  }
});

test('lint: .vue/.svelte components get the framework plugin preset', async () => {
  const { buildEslintConfig } = await import(
    pathToFileURL(join(PKG, 'lint/eslint/build.mjs')).href
  );
  const catalog = JSON.parse(readFileSync(join(PKG, 'lint/rules.json'), 'utf8'));
  const vuePreset = [{ files: ['**/*.vue'], rules: { 'vue/x': 'error' } }];
  const { config } = buildEslintConfig(catalog, {
    level: 'standard',
    srcDirs: ['src'],
    plugins: { vue: { configs: { 'flat/recommended': vuePreset } } },
  });
  assert.ok(
    config.some((c) => c.files?.includes('**/*.vue')),
    'Vue preset included',
  );
  const none = buildEslintConfig(catalog, { level: 'standard', srcDirs: ['src'], plugins: {} });
  assert.ok(!none.config.some((c) => c.files?.includes('**/*.vue')), 'no plugin, no .vue');
});

test('without project gates lint-aquila does not enter CI alone', () => {
  const root = project({ 'package.json': JSON.stringify({ name: 'x' }) }, { node: false });
  try {
    const { out } = aquila(root, 'init');
    const cfg = JSON.parse(readIn(root, 'docs/ai/aquila.json'));
    assert.deepEqual(cfg.gates, {});
    assert.deepEqual(cfg.hooks.ci, []);
    assert.match(out, /no CI gates detected/);
  } finally {
    cleanup(root);
  }
});

test('lint: aliases run the aquila-react-ai rule under the project name (its disables cover it)', async () => {
  const { buildEslintConfig, aquilaPlugin } = await import(
    pathToFileURL(join(PKG, 'lint/eslint/build.mjs')).href
  );
  const catalog = JSON.parse(readFileSync(join(PKG, 'lint/rules.json'), 'utf8'));
  const { config } = buildEslintConfig(catalog, {
    level: 'high',
    srcDirs: ['src'],
    plugins: {},
    aliases: { 'local/max-params': 'aquila/max-params', 'jest/x': 'aquila/max-params', bad: 'aquila/nothing' },
  });
  const named = config.filter((c) => c.rules?.['local/max-params']);
  assert.ok(named.length, 'rule under the project name');
  assert.ok(!config.some((c) => c.rules?.['aquila/max-params']), 'not under the aquila-react-ai name');
  assert.equal(named[0].plugins.local.rules['max-params'], aquilaPlugin.rules['max-params']);
  assert.ok(named[0].plugins.aquila, 'the aquila plugin stays (config-only-env)');
});

test('lint: ESLint runs through node (no shell or .cmd shims) with cache', () => {
  const root = project({
    'src/a.ts': '',
    'node_modules/eslint/bin/eslint.js':
      "require('fs').writeFileSync('argv.json', JSON.stringify(process.argv.slice(2)));",
  });
  try {
    aquila(root, 'init', '--lint=standard');
    assert.equal(aquila(root, 'lint').code, 0);
    const argv = JSON.parse(readIn(root, 'argv.json'));
    assert.ok(argv.includes('--max-warnings=0') && argv.includes('src'), argv.join(' '));
    assert.deepEqual(argv.slice(argv.indexOf('--cache')), [
      '--cache',
      '--cache-location',
      'node_modules/.cache/aquila-eslint',
      'src',
    ]);
  } finally {
    cleanup(root);
  }
});
