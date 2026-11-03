import assert from 'node:assert/strict';
import { test } from 'node:test';
import { join } from 'node:path';
import { symlinkSync } from 'node:fs';
import { LINK_TYPE, project, aquila, readIn, cleanup } from './helpers.mjs';
import { defaultConfig, detectStack, workspaces } from '../bin/stack.mjs';
import { DEFAULT_CONFIG_PATHS, globToRegex } from '../bin/aquila.mjs';

test('stack module uses the explicit root and keeps the CLI config contract', () => {
  const node = project(
    {
      'package.json': JSON.stringify({ workspaces: ['apps/*'] }),
      'apps/web/package.json': JSON.stringify({ scripts: { test: 'node --test' } }),
      'apps/web/src/app.js': '',
      'package-lock.json': '{}',
    },
    { node: false },
  );
  const react = project();
  try {
    assert.deepEqual(workspaces(node), ['apps/web']);
    assert.deepEqual(workspaces(react), []);
    assert.equal(detectStack(node).name, 'node-react', 'single preset');
    assert.equal(detectStack(node).detected, false);
    assert.equal(detectStack(react).detected, true);
    assert.equal(detectStack(react).lintEngine, 'eslint');
    assert.ok(globToRegex('apps/**/src/*.js').test('apps/web/src/app.js'));

    const result = aquila(node, 'init', '--lint=off');
    assert.equal(result.code, 0, result.out);
    const cfg = JSON.parse(readIn(node, 'docs/ai/aquila.json'));
    assert.deepEqual(
      defaultConfig(
        node,
        detectStack(node),
        { lint: 'off' },
        {
          budgets: cfg.budgets,
          configPaths: DEFAULT_CONFIG_PATHS,
        },
      ),
      cfg,
    );
    assert.equal(cfg.qa.tracker, 'GitHub Issues');
    assert.deepEqual(cfg.ci, { 'node-version': '22', 'install-command': 'npm ci', cache: 'npm' });
  } finally {
    cleanup(node);
    cleanup(react);
  }
});

test('monorepo: detects React in a package and runs the scripts in the workspaces', () => {
  const pkg = (o) => JSON.stringify(o);
  const root = project(
    {
      'package.json': pkg({ name: 'mono', workspaces: ['services/*', 'apps/*'] }),
      'services/api/package.json': pkg({
        dependencies: { react: '19' },
        scripts: { test: 'jest', typecheck: 'tsc' },
      }),
      'services/api/src/main.ts': '',
      'apps/web/package.json': pkg({ scripts: { test: 'vitest', lint: 'eslint .' } }),
      'apps/web/src/App.tsx': '',
    },
    { node: false },
  );
  try {
    const { out } = aquila(root, 'init');
    assert.doesNotMatch(out, /react not found/);
    const cfg = JSON.parse(readIn(root, 'docs/ai/aquila.json'));
    assert.equal(cfg.stack, 'node-react');
    assert.deepEqual(cfg.workspaces, ['services/api', 'apps/web']);
    assert.equal(cfg.gates.test, 'npm run test --workspaces --if-present');
    assert.equal(cfg.gates.typecheck, 'npm run typecheck --workspaces --if-present');
    assert.deepEqual(cfg.srcDirs, ['services/api/src', 'apps/web/src']);
  } finally {
    cleanup(root);
  }
});

test('Nx-style workspaces with two-level globs', () => {
  const nx = project(
    {
      'package.json': JSON.stringify({ workspaces: ['libs/*/*'] }),
      'libs/shared/util/package.json': JSON.stringify({ scripts: { test: 'jest' } }),
    },
    { node: false },
  );
  try {
    aquila(nx, 'init');
    const n = JSON.parse(readIn(nx, 'docs/ai/aquila.json'));
    assert.deepEqual(n.workspaces, ['libs/shared/util']);
    assert.equal(n.gates.test, 'npm run test --workspaces --if-present');
  } finally {
    cleanup(nx);
  }
});

test('coverage is only "enforced" when a gate fails below the threshold', () => {
  const target = project();
  const enforced = project({ 'jest.config.js': 'module.exports = { coverageThreshold: {} };\n' });
  try {
    aquila(target, 'init');
    assert.equal(JSON.parse(readIn(target, 'docs/ai/aquila.json')).coverage.enforced, false);
    assert.match(readIn(target, 'AGENTS.md'), /branches ≥ 85 \(target — no gate enforces it/);
    aquila(enforced, 'init');
    assert.equal(JSON.parse(readIn(enforced, 'docs/ai/aquila.json')).coverage.enforced, true);
    assert.match(readIn(enforced, 'AGENTS.md'), /branches ≥ 85 \(enforced by the `coverage` command\)/);
  } finally {
    cleanup(target);
    cleanup(enforced);
  }
});

test('workspaces honors exclusions in stack detection, sources and gates', () => {
  const root = project(
    {
      'package.json': JSON.stringify({ workspaces: ['apps/*', '!apps/legacy'] }),
      'apps/web/package.json': JSON.stringify({ scripts: { test: 'node --test' } }),
      'apps/web/src/app.js': '',
      'apps/legacy/package.json': JSON.stringify({
        dependencies: { react: '19' },
        scripts: { typecheck: 'tsc' },
      }),
      'apps/legacy/src/main.ts': '',
    },
    { node: false },
  );
  try {
    assert.deepEqual(workspaces(root), ['apps/web']);
    assert.equal(detectStack(root).detected, false, 'excluded package does not count');
    const result = aquila(root, 'init', '--tools=codex', '--lint=off');
    assert.equal(result.code, 0, result.out);
    const cfg = JSON.parse(readIn(root, 'docs/ai/aquila.json'));
    assert.deepEqual(cfg.workspaces, ['apps/web']);
    assert.deepEqual(cfg.srcDirs, ['apps/web/src']);
    assert.equal(cfg.gates.typecheck, undefined);
  } finally {
    cleanup(root);
  }
});

test('pnpm workspaces support exclusions regardless of order and deep globs', () => {
  const deep = 'libs/a/b/c/d/e/f/util';
  const root = project(
    {
      'package.json': '{}',
      'pnpm-workspace.yaml': "packages:\n  - '!libs/**/legacy'\n  - 'libs/**'\n",
      [`${deep}/package.json`]: JSON.stringify({ scripts: { test: 'node --test' } }),
      'libs/a/legacy/package.json': '{}',
    },
    { node: false },
  );
  try {
    assert.deepEqual(workspaces(root), [deep]);
    aquila(root, 'init', '--tools=codex', '--lint=off');
    const cfg = JSON.parse(readIn(root, 'docs/ai/aquila.json'));
    assert.deepEqual(cfg.workspaces, [deep]);
    assert.equal(cfg.gates.test, 'pnpm -r --if-present run test');
  } finally {
    cleanup(root);
  }
});

test('workspaces does not follow directory links or cycles', () => {
  const root = project(
    {
      'package.json': JSON.stringify({ workspaces: ['packages/**', 'linked/*'] }),
      'packages/a/package.json': '{}',
    },
    { node: false },
  );
  const external = project({ 'outside/package.json': '{}' }, { node: false });
  try {
    symlinkSync(join(root, 'packages'), join(root, 'packages/a/cycle'), LINK_TYPE);
    symlinkSync(external, join(root, 'linked'), LINK_TYPE);
    assert.deepEqual(workspaces(root), ['packages/a']);
  } finally {
    cleanup(root);
    cleanup(external);
  }
});
