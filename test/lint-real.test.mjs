// Real ESLint runs (opt-in: AQUILA_LINT_DEPS=<folder with node_modules of eslint, typescript-eslint, typescript,
// eslint-plugin-sonarjs, eslint-plugin-unicorn, eslint-plugin-jest, reflect-metadata>). The project lives in a
// repository whose root node_modules is that folder's (hoisted, as in npm workspaces).
//   npm i --prefix <dir> eslint@9 typescript-eslint typescript eslint-plugin-sonarjs eslint-plugin-unicorn@65.0.1 eslint-plugin-jest reflect-metadata
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { PROFILE } from '../bin/profile.mjs';
import { aquila, editConfig, LINK_TYPE, NAME, PKG } from './helpers.mjs';

const DEPS = process.env.AQUILA_LINT_DEPS;
const skip = DEPS ? false : 'set AQUILA_LINT_DEPS to run ESLint for real';

function workspace(files) {
  const top = mkdtempSync(join(DEPS ?? '.', 'repo-'));
  execFileSync('git', ['init', '-q'], { cwd: top });
  symlinkSync(join(DEPS, 'node_modules'), join(top, 'node_modules'), LINK_TYPE);
  const root = join(top, 'app');
  mkdirSync(join(root, 'node_modules'), { recursive: true });
  symlinkSync(PKG, join(root, 'node_modules', NAME), LINK_TYPE);
  const all = {
    'package.json': JSON.stringify({ dependencies: { [PROFILE.framework]: PROFILE.frameworkRange }, scripts: { test: 'node -e 0' } }),
    'tsconfig.json': JSON.stringify({
      // The tsconfig the linter reads does not carry the decorator flags (a build tsconfig does, here: tsc's
      // command line), so only aquila's own parserOptions keep the injected import a value.
      compilerOptions: { target: 'ES2022', module: 'commonjs', strict: true, rootDir: 'src', outDir: 'dist', skipLibCheck: true },
      include: ['src'],
    }),
    ...files,
  };
  for (const [path, content] of Object.entries(all)) {
    mkdirSync(join(root, path, '..'), { recursive: true });
    writeFileSync(join(root, path), content);
  }
  return { top, root };
}
const drop = (top) => {
  for (const link of [join(top, 'node_modules'), join(top, 'app', 'node_modules', NAME)])
    try {
      unlinkSync(link);
    } catch {}
  rmSync(top, { recursive: true, force: true });
};

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
