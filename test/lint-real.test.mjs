// Real ESLint runs (opt-in: AQUILA_LINT_DEPS=<folder with node_modules of eslint, typescript-eslint, typescript,
// eslint-plugin-sonarjs, eslint-plugin-unicorn, eslint-plugin-jest, reflect-metadata>). The project lives in a
// repository whose root node_modules is that folder's (hoisted, as in npm workspaces).
//   npm i --prefix <dir> eslint@9 typescript-eslint typescript eslint-plugin-sonarjs eslint-plugin-unicorn@65.0.1 eslint-plugin-jest reflect-metadata
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { PROFILE } from '../bin/profile.mjs';
import { aquila, dropWorkspace, editConfig, lintWorkspace, NAME } from './helpers.mjs';

const DEPS = process.env.AQUILA_LINT_DEPS;
const skip = DEPS ? false : 'set AQUILA_LINT_DEPS to run ESLint for real';

const workspace = (files) => lintWorkspace(DEPS, files);
const drop = dropWorkspace;

test('lint --baseline: existing violations do not fail, a new one does', { skip }, () => {
  const { top, root } = workspace({ 'src/old.ts': 'export function a(x: number) {\n  if (x) return 1;\n  return 2;\n}\n' });
  try {
    assert.equal(aquila(root, 'init', '--tools=codex', '--lint=standard').code, 0);
    editConfig(root, (cfg) => {
      cfg.lint.overrides = { curly: 'error' };
    });
    assert.equal(aquila(root, 'lint').code, 1, 'the legacy violation fails before the baseline');
    const base = aquila(root, 'lint', '--baseline');
    assert.equal(base.code, 0, base.out);
    assert.ok(readFileSync(join(root, 'docs/ai/lint-baseline.json'), 'utf8').includes('old.ts'));
    assert.equal(aquila(root, 'lint').code, 0, 'recorded violation passes');
    writeFileSync(join(root, 'src/new.ts'), 'export function b(y: number) {\n  if (y) return 1;\n  return 2;\n}\n');
    assert.equal(aquila(root, 'lint').code, 1, 'a new violation fails');
  } finally {
    drop(top);
  }
});

test('NestJS: lint --fix at level high keeps constructor-injected imports as values (DI metadata)', { skip: skip || (!PROFILE.lint.decoratorMetadata && 'NestJS only') }, () => {
  const { top, root } = workspace({
    'src/repo.ts': 'export class Repo {\n  find(): string {\n    return "ok";\n  }\n}\n',
    'src/injectable.ts': 'export const Injectable = (): ClassDecorator => () => undefined;\n',
    'src/service.ts': [
      "import 'reflect-metadata';",
      "import { Injectable } from './injectable';",
      "import { Repo } from './repo';",
      '',
      '@Injectable()',
      'export class Service {',
      '  constructor(private readonly repo: Repo) {}',
      '',
      '  run(): string {',
      '    return this.repo.find();',
      '  }',
      '}',
      '',
    ].join('\n'),
  });
  try {
    assert.equal(aquila(root, 'init', '--tools=codex', '--lint=high').code, 0);
    aquila(root, 'lint', '--fix');
    const service = readFileSync(join(root, 'src/service.ts'), 'utf8');
    assert.match(service, /^import \{ Repo \} from '\.\/repo';$/m, 'not turned into `import type`');
    const tsc = spawnSync(process.execPath, [join(DEPS, 'node_modules/typescript/bin/tsc'), '-p', root, '--experimentalDecorators', '--emitDecoratorMetadata'], { encoding: 'utf8' });
    assert.equal(tsc.status, 0, tsc.stdout);
    const run = spawnSync(process.execPath, ['-e', "const { Service } = require('./dist/service'); const { Repo } = require('./dist/repo'); const [t] = Reflect.getMetadata('design:paramtypes', Service); if (t !== Repo) process.exit(1); console.log(new Service(new t()).run());"], { cwd: root, encoding: 'utf8' });
    assert.equal(run.status, 0, run.stderr);
    assert.equal(run.stdout.trim(), 'ok');
  } finally {
    drop(top);
  }
});

const eslint = (root, ...args) =>
  spawnSync(process.execPath, [join(process.env.AQUILA_LINT_DEPS ?? '.', 'node_modules/eslint/bin/eslint.js'), ...args], {
    cwd: root,
    encoding: 'utf8',
    env: { ...process.env, AQUILA_ROOT: root },
  });

test("the project's own ESLint with aquilaEslintCompat(): aquila-only disables resolve and survive --fix", { skip }, () => {
  const source = '// eslint-disable-next-line sonarjs/pseudo-random\nexport const roll = (): number => Math.random();\n';
  const config = (compat) =>
    [
      "import tseslint from 'typescript-eslint';",
      ...(compat ? [`import { aquilaEslintCompat } from '${NAME}/lint/eslint/compat.mjs';`] : []),
      'export default [',
      "  { linterOptions: { reportUnusedDisableDirectives: 'error' } },",
      '  ...tseslint.configs.recommended,',
      ...(compat ? ['  aquilaEslintCompat(),'] : []),
      '];',
      '',
    ].join('\n');
  const { top, root } = workspace({ 'src/roll.ts': source, 'eslint.config.mjs': config(false) });
  try {
    assert.equal(aquila(root, 'init', '--tools=codex', '--lint=high').code, 0);
    const without = eslint(root, 'src');
    assert.equal(without.status, 1, 'control: without the helper the directive breaks the project lint');
    assert.match(without.stdout, /Definition for rule 'sonarjs\/pseudo-random' was not found/);
    writeFileSync(join(root, 'eslint.config.mjs'), config(true));
    const lint = eslint(root, 'src');
    assert.equal(lint.status, 0, lint.stdout + lint.stderr);
    eslint(root, '--fix', 'src');
    assert.equal(readFileSync(join(root, 'src/roll.ts'), 'utf8'), source, '--fix keeps the directive');
  } finally {
    drop(top);
  }
});

test('lint --fix leaves unicorn/prefer-at as a suggestion: the typecheck stays green without noUncheckedIndexedAccess', { skip }, () => {
  const source = 'export function last(items: number[]): number {\n  return items[items.length - 1];\n}\n';
  const { top, root } = workspace({ 'src/last.ts': source });
  try {
    assert.equal(aquila(root, 'init', '--tools=codex', '--lint=high').code, 0);
    const fix = aquila(root, 'lint', '--fix');
    assert.match(fix.out, /unicorn\/prefer-at/, 'still reported');
    assert.equal(readFileSync(join(root, 'src/last.ts'), 'utf8'), source, 'not rewritten to .at(-1)');
    const tsc = spawnSync(process.execPath, [join(DEPS, 'node_modules/typescript/bin/tsc'), '-p', root, '--noEmit'], { encoding: 'utf8' });
    assert.equal(tsc.status, 0, tsc.stdout);
  } finally {
    drop(top);
  }
});

test('srcDirs = testDirs = src: production-only rules skip *.test.* files, test rules skip production files', { skip }, () => {
  const { top, root } = workspace({ 'src/a.ts': 'export const a = 1;\n', 'src/a.test.ts': 'export const b = 1;\n' });
  try {
    assert.equal(aquila(root, 'init', '--tools=codex', '--lint=high').code, 0);
    editConfig(root, (cfg) => {
      cfg.srcDirs = ['src'];
      cfg.testDirs = ['src'];
    });
    const rulesOf = (file) => {
      const r = eslint(root, '--config', `node_modules/${NAME}/lint/eslint/eslint.config.mjs`, '--print-config', file);
      assert.equal(r.status, 0, r.stderr);
      return JSON.parse(r.stdout).rules;
    };
    const on = (value) => value !== undefined && [value].flat()[0] !== 0 && [value].flat()[0] !== 'off';
    const prod = rulesOf('src/a.ts');
    const tests = rulesOf('src/a.test.ts');
    assert.ok(on(prod['max-lines-per-function']), 'production code keeps it');
    assert.ok(!on(tests['max-lines-per-function']), 'a test next to the code does not get it');
    assert.ok(!Object.entries(prod).some(([rule, value]) => rule.startsWith('jest/') && on(value)), 'no test rule on production code');
  } finally {
    drop(top);
  }
});
