// Regressions found by porting edp-ai's scan to aquila-react-ai (0.4.1): one test per fixed defect.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { pathToFileURL } from 'node:url';
import { globToRegex, splitGlobs } from '../bin/glob.mjs';
import { ciCaller, TOOL_MISSING } from '../bin/aquila.mjs';
import { PKG, aquila, cleanup, editConfig, git, project, readIn } from './helpers.mjs';

const smoke = (root, extra = {}) =>
  editConfig(root, (cfg) => {
    cfg.gates = { smoke: 'node -e "process.exit(0)"', ...extra };
    cfg.hooks = { ci: Object.keys(cfg.gates), 'pre-commit': [], 'pre-push': [] };
  });

test('glob: braces, ?, ./ and a folder with or without a slash match like .gitignore', () => {
  for (const [glob, file] of [
    ['src/**/*.{ts,js}', 'src/a/b.ts'],
    ['src/**/*.{ts,js}', 'src/b.js'],
    ['./src/**', 'src/x.ts'],
    ['src', 'src/x/y.ts'],
    ['src/', 'src/x.ts'],
    ['src/?.ts', 'src/a.ts'],
  ])
    assert.ok(globToRegex(glob).test(file), `${glob} ↔ ${file}`);
  assert.ok(!globToRegex('src/**/*.{ts,js}').test('src/a.py'));
  assert.ok(!globToRegex('src').test('srcx/a.ts'));
  assert.deepEqual(splitGlobs('src/**/*.{ts,js}, test/**'), ['src/**/*.{ts,js}', 'test/**']);
});

test('sync: `$` in gate commands does not corrupt the routers', () => {
  const root = project();
  try {
    assert.equal(aquila(root, 'init', '--tools=codex', '--lint=off').code, 0);
    smoke(root, { dollar: `node -e "console.log('$$ $' + "'" + ' $&')"` });
    assert.equal(aquila(root, 'sync').code, 0);
    const first = readIn(root, 'AGENTS.md');
    assert.ok(first.includes(`'$$ $' + "'" + ' $&'`), 'literal command in the checklist');
    assert.equal(aquila(root, 'sync').code, 0);
    assert.equal(readIn(root, 'AGENTS.md'), first);
    assert.equal(aquila(root, 'check').code, 0);
  } finally {
    cleanup(root);
  }
});

test('config: a BOM in aquila.json (Windows PowerShell 5) does not break the commands', () => {
  const root = project();
  try {
    assert.equal(aquila(root, 'init', '--tools=codex', '--lint=off').code, 0);
    writeFileSync(join(root, 'docs/ai/aquila.json'), `\uFEFF${readIn(root, 'docs/ai/aquila.json')}`);
    const check = aquila(root, 'check');
    assert.equal(check.code, 0, check.out);
  } finally {
    cleanup(root);
  }
});

test('doctor: an invalid config shows the schema errors instead of crashing', () => {
  const root = project();
  try {
    assert.equal(aquila(root, 'init', '--tools=codex', '--lint=off').code, 0);
    writeFileSync(join(root, 'docs/ai/aquila.json'), '{"version": 1}');
    const result = aquila(root, 'doctor');
    assert.equal(result.code, 1);
    assert.match(result.out, /invalid/);
    assert.doesNotMatch(result.out, /TypeError/);
  } finally {
    cleanup(root);
  }
});

test('gate: a gate without a command fails on its own and the others run', () => {
  const root = project();
  try {
    assert.equal(aquila(root, 'init', '--tools=codex', '--lint=off').code, 0);
    smoke(root, { broken: {} });
    const result = aquila(root, 'gate', 'ci');
    assert.equal(result.code, 1);
    assert.match(result.out, /broken: gate without a command/);
    assert.match(result.out, /✓ smoke/);
  } finally {
    cleanup(root);
  }
});

test('gate: "not recognized" in Portuguese (Windows pt-BR/pt-PT) counts as a missing tool', () => {
  assert.match("'eslint' não é reconhecido como um comando interno", TOOL_MISSING);
});

test('an empty done.gates falls back to hooks.ci in the checklist', () => {
  const root = project();
  try {
    assert.equal(aquila(root, 'init', '--tools=codex', '--lint=off').code, 0);
    smoke(root);
    editConfig(root, (cfg) => {
      cfg.done = { gates: [] };
    });
    assert.equal(aquila(root, 'sync').code, 0);
    assert.match(readIn(root, 'AGENTS.md'), /- \[ \] smoke: `node -e/);
  } finally {
    cleanup(root);
  }
});

test('local: versioned settings are not rewritten; audit_*.md is excluded; template examples stay out', () => {
  const settings = '{ "editor.tabSize": 2 }\n';
  const root = project({ '.vscode/settings.json': settings });
  try {
    execFileSync('git', ['add', '.vscode/settings.json'], { cwd: root });
    const result = aquila(root, 'init', '--mode=local', '--tools=copilot', '--lint=off');
    assert.equal(result.code, 0, result.out);
    assert.equal(readIn(root, '.vscode/settings.json'), settings);
    assert.match(result.out, /\.vscode\/settings\.json is versioned and in local mode/);
    const exclude = readFileSync(join(root, git(root, 'rev-parse', '--git-path', 'info/exclude')), 'utf8');
    assert.match(exclude, /^\/audit_\*\.md$/m);
    assert.doesNotMatch(readIn(root, '.github/copilot-instructions.md'), /<(?:e\.g\.|ex\.):/);
    assert.equal(aquila(root, 'check').code, 0, 'no drift reported for the untouched file');
  } finally {
    cleanup(root);
  }
});

test('init: a fixing script in a single workspace, or prettier -w, is not a gate', () => {
  const root = project(
    {
      'package.json': JSON.stringify({ workspaces: ['packages/*'], scripts: { format: 'prettier -w .' } }),
      'packages/a/package.json': JSON.stringify({ scripts: { lint: 'eslint . --fix' } }),
      'packages/b/package.json': JSON.stringify({ scripts: { lint: 'eslint .' } }),
    },
    { node: false },
  );
  try {
    const result = aquila(root, 'init', '--tools=codex', '--lint=off');
    assert.equal(result.code, 0, result.out);
    const { gates } = JSON.parse(readIn(root, 'docs/ai/aquila.json'));
    assert.equal(gates.lint, undefined);
    assert.equal(gates.format, undefined);
    assert.match(result.out, /gates\.lint: script lint changes files/);
  } finally {
    cleanup(root);
  }
});

test('ciCaller: a multi-line install command stays valid YAML', () => {
  const yaml = ciCaller({ ci: { 'node-version': '22', 'install-command': "npm ci\necho 'ok'" } });
  assert.match(yaml, /^ {6}- run: "npm ci\\necho 'ok'"$/m);
});

test('guard-bash: --no-verify and force-push variants', async () => {
  const { blocked } = await import(pathToFileURL(join(PKG, 'hooks/guard-bash.mjs')).href);
  for (const cmd of [
    'git push -fu origin x',
    'git commit --no-verif -m x',
    'git push --mirror origin',
    'git.exe push --force',
    'C:/Git/bin/git.exe commit --no-verify',
  ])
    assert.ok(blocked(cmd), cmd);
  for (const cmd of ['git push -u origin x', 'git push --force-with-lease', 'git log --grep=fu'])
    assert.equal(blocked(cmd), null, cmd);
});

test('lint: eslint-config-prettier does not switch catalog rules off; empty srcDirs gives no files: []', async () => {
  const { buildEslintConfig } = await import(pathToFileURL(join(PKG, 'lint/eslint/build.mjs')).href);
  const catalog = JSON.parse(readFileSync(join(PKG, 'lint/rules.json'), 'utf8'));
  const prettier = { rules: { curly: 'off' } };
  const { config } = buildEslintConfig(catalog, { srcDirs: ['src'], root: '/r', level: 'standard', plugins: { prettier } });
  const curly = config.findLastIndex((c) => c.rules && 'curly' in c.rules);
  assert.notEqual(config[curly], prettier, 'the catalog has the last word on curly');
  assert.ok(config.indexOf(prettier) < curly);
  const empty = buildEslintConfig(catalog, { srcDirs: [], root: '/r', level: 'high', plugins: {} });
  assert.ok(empty.config.every((c) => !c.files || c.files.length));
});
