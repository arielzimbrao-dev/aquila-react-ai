// 0.3.0: init reads the project (lint script without --fix, its coverage, the identifiers' language, doc
// templates in the docs language), --help everywhere, lint plugins and versions, done.gates, autoCommit and
// the AGENTS.md budget.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { PROFILE } from '../bin/profile.mjs';
import { aquila, CLI, cleanup, editConfig, install, NAME, project, readIn } from './helpers.mjs';

const json = (value) => JSON.stringify(value);
const pkg = (scripts, extra = {}) =>
  json({ dependencies: { [PROFILE.framework]: PROFILE.frameworkRange }, scripts, ...extra });
const config = (root) => JSON.parse(readIn(root, 'docs/ai/aquila.json'));

test('--help / -h on every command lists its flags and exits 0', () => {
  for (const cmd of ['init', 'sync', 'check', 'doctor', 'gate', 'lint', 'tokens']) {
    for (const flag of ['--help', '-h']) {
      const r = spawnSync(process.execPath, [CLI, cmd, flag], { encoding: 'utf8' });
      assert.equal(r.status, 0, `${cmd} ${flag}`);
      assert.match(r.stdout, new RegExp(`npx ${NAME} ${cmd}`));
    }
  }
  const init = spawnSync(process.execPath, [CLI, 'init', '--help'], { encoding: 'utf8' }).stdout;
  for (const flag of ['--lang', '--code-lang', '--tools', '--token-limit', '--mode', '--lint', '--pr-max-files', '--hooks', '--install'])
    assert.ok(init.includes(flag), flag);
});

test('the detected lint gate never uses a script that fixes files', () => {
  const root = project({ 'package.json': pkg({ lint: 'eslint . --fix', 'lint:check': 'eslint .', test: 'jest' }) });
  try {
    assert.equal(aquila(root, 'init', '--tools=codex', '--lint=off').code, 0);
    assert.equal(config(root).gates.lint, 'npm run lint:check');
  } finally {
    cleanup(root);
  }
  const only = project({ 'package.json': pkg({ lint: 'eslint . --fix', test: 'jest' }) });
  try {
    const init = aquila(only, 'init', '--tools=codex', '--lint=off');
    assert.equal(config(only).gates.lint, undefined);
    assert.match(init.out, /gates\.lint: script lint changes files \(--fix\/--write\) and is not used in hooks/);
  } finally {
    cleanup(only);
  }
});

test("coverage comes from the project's own thresholds (jest coverageThreshold / vitest thresholds)", () => {
  const root = project({
    'package.json': pkg({ test: 'jest', 'test:cov': 'jest --coverage' }),
    'jest.config.js': 'module.exports = { coverageThreshold: { global: { branches: 75, functions: 90, lines: 88, statements: 90 } } };\n',
  });
  try {
    const init = aquila(root, 'init', '--tools=codex', '--lint=off');
    const cfg = config(root);
    assert.deepEqual(
      { statements: cfg.coverage.statements, functions: cfg.coverage.functions, lines: cfg.coverage.lines, branches: cfg.coverage.branches },
      { statements: 90, functions: 90, lines: 88, branches: 75 },
    );
    assert.equal(cfg.coverage.enforced, true);
    assert.match(init.out, /coverage from the project's own thresholds/);
    // coverage runs the suite: CI does not run the tests twice.
    assert.ok(cfg.hooks.ci.includes('coverage'));
    assert.ok(!cfg.hooks.ci.includes('test'));
  } finally {
    cleanup(root);
  }
});

test('identifiers in Portuguese set language.code; --code-lang wins', () => {
  const files = {
    'package.json': pkg({ test: 'jest' }),
    'src/pedido.ts': [
      'export function buscarPedido(codigo: string) { return codigo; }',
      'export function criarPedido(cliente: string) { return cliente; }',
      'export function listarProdutos() { return []; }',
      'export const calcularValorTotal = (itens: number[]) => itens.length;',
      'export class ServicoDePagamento { atualizarEstoque() {} excluirCadastro() {} }',
      '',
    ].join('\n'),
  };
  const root = project(files);
  try {
    const init = aquila(root, 'init', '--tools=codex', '--lint=off', '--lang=pt-BR');
    assert.equal(config(root).language.code, 'pt-BR');
    assert.match(init.out, /identifiers in the source are in Portuguese/);
  } finally {
    cleanup(root);
  }
  const forced = project(files);
  try {
    aquila(forced, 'init', '--tools=codex', '--lint=off', '--code-lang=en');
    assert.equal(config(forced).language.code, 'en');
  } finally {
    cleanup(forced);
  }
});

test('--lang=pt-BR / pt-PT writes the docs/ indexes in that language', () => {
  for (const [lang, word] of [['pt-BR', 'arquivo'], ['pt-PT', 'ficheiro']]) {
    const root = project({ 'package.json': pkg({ test: 'jest' }) });
    try {
      assert.equal(aquila(root, 'init', '--tools=codex', '--lint=off', `--lang=${lang}`).code, 0);
      assert.match(readIn(root, 'docs/adr/README.md'), /^# ADR — decisões de arquitetura/);
      assert.ok(readIn(root, 'docs/adr/README.md').includes(word), `${lang}: ${word}`);
      for (const dir of ['c4', 'tracks', 'reference', 'runbooks'])
        assert.doesNotMatch(readIn(root, `docs/${dir}/README.md`), /^# (C4 — architecture|Task tracks|Reference — how|Runbooks — how)/, dir);
    } finally {
      cleanup(root);
    }
  }
});

test('lint high on a project without the plugins: init prints the exact install, doctor reports it', () => {
  const root = project({
    'package.json': pkg({ test: 'jest' }),
    'tsconfig.json': '{}',
    'node_modules/eslint/package.json': json({ name: 'eslint', version: '9.39.0' }),
    'node_modules/eslint/bin/eslint.js': '',
  });
  try {
    const init = aquila(root, 'init', '--tools=codex', '--lint=high');
    assert.match(init.out, /typescript-eslint is not installed \(tsconfig\.json found/);
    assert.match(init.out, /eslint-plugin-unicorn@65\.0\.1/, 'unicorn 65 for ESLint 9');
    const doctor = aquila(root, 'doctor').out;
    assert.match(doctor, /plugins missing \(their rules are skipped\) → npm i -D [^\n]*eslint-plugin-sonarjs/);
  } finally {
    cleanup(root);
  }
});

test('doctor flags ESLint 8 and a unicorn that needs ESLint 10', () => {
  const root = project({
    'package.json': pkg({ test: 'jest' }),
    'node_modules/eslint/package.json': json({ name: 'eslint', version: '8.57.0' }),
    'node_modules/eslint/bin/eslint.js': '',
    'node_modules/eslint-plugin-unicorn/package.json': json({ name: 'eslint-plugin-unicorn', version: '66.0.0' }),
  });
  try {
    aquila(root, 'init', '--tools=codex', '--lint=high');
    const doctor = aquila(root, 'doctor').out;
    assert.match(doctor, /ESLint 8\.57\.0 found: [^\n]* needs ESLint ≥ 9 \(flat config\)/);
    assert.match(doctor, /eslint-plugin-unicorn 66\.0\.0 needs ESLint 10/);
  } finally {
    cleanup(root);
  }
});

test('the eslint engine is found when hoisted to a parent folder (workspaces)', async () => {
  const { missingTool } = await import(new URL('../bin/lint.mjs', import.meta.url).href);
  const root = project({
    'package.json': pkg({ test: 'jest' }),
    'node_modules/eslint/package.json': json({ name: 'eslint', version: '9.39.0' }),
    'node_modules/eslint/bin/eslint.js': '',
    'app/package.json': pkg({ test: 'jest' }),
  });
  try {
    assert.equal(missingTool('eslint', join(root, 'app')), null);
  } finally {
    cleanup(root);
  }
});

test('done.gates is independent of hooks.ci; workflow.autoCommit adds the standing commit instruction', () => {
  const root = project({ 'package.json': pkg({ test: 'jest', typecheck: 'tsc' }) });
  try {
    install(root);
    assert.equal(aquila(root, 'init', '--tools=codex', '--lint=off').code, 0);
    editConfig(root, (cfg) => {
      cfg.hooks.ci = ['typecheck'];
      cfg.done = { gates: ['typecheck', 'test'] };
      cfg.workflow = { autoCommit: true };
    });
    assert.equal(aquila(root, 'sync').code, 0);
    const agents = readIn(root, 'AGENTS.md');
    assert.match(agents, /- \[ \] test: `npm run test`/, 'test stays a done criterion outside CI');
    assert.match(agents, /standing instruction from the project owner \(`workflow\.autoCommit`\)/);
    assert.match(agents, /not counting generated ones: `\.aquila\/`/);
    // The always-loaded router stays within its budget with a typical config.
    assert.ok(agents.length <= 3500, `AGENTS.md is ${agents.length} chars`);
    assert.equal(aquila(root, 'check').code, 0);
    editConfig(root, (cfg) => {
      cfg.done = { gates: ['nope'] };
    });
    assert.match(aquila(root, 'check').out, /done\.gates: gate "nope" is not in gates/);
  } finally {
    cleanup(root);
  }
});

test('team mode versions the /aquila-* commands; local mode keeps them out of git', () => {
  for (const [mode, excluded] of [['team', false], ['local', true]]) {
    const root = project({ 'package.json': pkg({ test: 'jest' }) });
    try {
      assert.equal(aquila(root, 'init', '--tools=claude', '--lint=off', `--mode=${mode}`).code, 0);
      const exclude = readFileSync(join(root, '.git/info/exclude'), 'utf8');
      assert.equal(/^\/\.claude\/commands\/aquila-plan\.md$/m.test(exclude), excluded, mode);
    } finally {
      cleanup(root);
    }
  }
});

test('init warns when no gate runs tests; check lists uncovered files only with --verbose', () => {
  const root = project({ 'package.json': pkg({ lint: 'eslint .' }), 'src/a.ts': 'export {};\n', '.github/instructions/x.instructions.md': "---\napplyTo: 'other/**'\n---\nx\n" });
  try {
    const init = aquila(root, 'init', '--tools=codex', '--lint=off');
    assert.match(init.out, /no test gate/);
    assert.match(aquila(root, 'doctor').out, /✗ no test gate/);
    const quiet = aquila(root, 'check').out;
    assert.match(quiet, /ℹ 1 file\(s\) in 1 folder\(s\) without per-folder instructions/);
    assert.doesNotMatch(quiet, /\n {2}src\/a\.ts/);
    assert.match(aquila(root, 'check', '--verbose').out, /src\/a\.ts/);
  } finally {
    cleanup(root);
  }
});

test('lint.overrides reach the ESLint config after the level', async () => {
  const { buildEslintConfig } = await import(new URL('../lint/eslint/build.mjs', import.meta.url).href);
  const catalog = JSON.parse(readFileSync(new URL('../lint/rules.json', import.meta.url), 'utf8'));
  const { config: eslint } = buildEslintConfig(catalog, {
    level: 'high',
    srcDirs: ['src'],
    plugins: {},
    overrides: { curly: 'off', 'max-lines-per-function': ['error', { max: 120 }] },
  });
  const last = eslint.at(-1);
  assert.equal(last.rules.curly, 'off');
  assert.deepEqual(last.rules['max-lines-per-function'], ['error', { max: 120 }]);
  assert.ok(existsSync(new URL('../bin/profile.mjs', import.meta.url)));
});

test('githooks/dispatcher: one LF script for both phases, v2 header, no package name hard-coded', () => {
  const dispatcher = readFileSync(new URL('../githooks/dispatcher', import.meta.url), 'utf8');
  assert.ok(!dispatcher.includes('\r\n'), 'sh breaks with CRLF');
  assert.match(dispatcher, /^#!\/bin\/sh\n# aquila-hooks v2 \(aquila-hooks dispatcher v2\) /);
  assert.match(dispatcher, /node_modules\/\$pkg\/bin\/aquila\.mjs/, 'runs whichever aquila package is registered');
  assert.doesNotMatch(dispatcher, /aquila-(?:react-|next-)?ai\/bin/);
});

test("frameworkMajor: the installed framework wins over the declared range; null without the stack's framework", async () => {
  const { frameworkMajor } = await import(new URL('../bin/aquila.mjs', import.meta.url).href);
  const declared = Number(/\d+/.exec(PROFILE.frameworkRange)[0]);
  const root = project({ 'package.json': pkg({}) });
  const bare = project({ 'package.json': json({}) });
  try {
    assert.equal(frameworkMajor(root), declared);
    const dir = join(root, 'node_modules', ...PROFILE.framework.split('/'));
    const { mkdirSync, writeFileSync } = await import('node:fs');
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'package.json'), json({ version: `${declared - 1}.2.3` }));
    assert.equal(frameworkMajor(root), declared - 1, 'installed version first');
    assert.equal(frameworkMajor(bare), null);
  } finally {
    cleanup(root);
    cleanup(bare);
  }
});
