import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { install, cleanup, aquila, editConfig, project, readIn } from './helpers.mjs';
import { hookIssues } from '../bin/checks.mjs';
import { workspaces } from '../bin/stack.mjs';
import { gate } from '../bin/aquila.mjs';

const init = (root) => aquila(root, 'init', '--tools=codex', '--lint=off');
const prepare = (root) => {
  install(root);
  assert.equal(init(root).code, 0);
  writeFileSync(join(root, 'docs/ai/CONTEXT.md'), '# Confirmed context\n');
  writeFileSync(join(root, 'docs/ai/golden.md'), '# Confirmed examples\n');
  editConfig(root, (cfg) => {
    cfg.gates = { smoke: 'node -e "process.exit(0)"' };
    cfg.hooks = { ci: ['smoke'], 'pre-commit': [], 'pre-push': ['smoke'] };
  });
  assert.equal(aquila(root, 'sync').code, 0);
};

test('DA-001: passing coverage does not hide a failing test', () => {
  const root = project({
    'package.json': JSON.stringify({
      scripts: {
        test: 'node -e "console.log(\'unit failure\');process.exit(7)"',
        'test:cov': 'node -e "process.exit(0)"',
      },
    }),
  });
  try {
    assert.equal(init(root).code, 0);
    const cfg = JSON.parse(readIn(root, 'docs/ai/aquila.json'));
    assert.deepEqual(cfg.hooks.ci, ['test', 'coverage']);
    const result = aquila(root, 'gate', 'ci');
    assert.equal(result.code, 1, result.out);
    assert.match(result.out, /unit failure/);
    assert.match(result.out, /1\/2 gates green/);
    editConfig(root, (c) => (c.hooks.ci = ['coverage']));
    aquila(root, 'init');
    assert.deepEqual(JSON.parse(readIn(root, 'docs/ai/aquila.json')).hooks.ci, ['coverage']);
  } finally {
    cleanup(root);
  }
});

test('DA-002: a preserved manual CI workflow stays unverified for readiness', () => {
  const caller = 'name: unrelated\non: [push]\njobs: {}\n';
  const root = project({ '.github/workflows/aquila-gates.yml': caller });
  try {
    prepare(root);
    assert.equal(aquila(root, 'check').code, 0);
    const ready = aquila(root, 'check', '--ready');
    assert.equal(ready.code, 1, ready.out);
    assert.match(ready.out, /manual CI integration not verified/);
    assert.equal(readIn(root, '.github/workflows/aquila-gates.yml'), caller);
  } finally {
    cleanup(root);
  }
});

test('DA-003: invalid phase and arity run no gates', () => {
  assert.throws(() => gate('cii'), /invalid phase/);
  const root = project();
  try {
    init(root);
    editConfig(root, (cfg) => {
      cfg.gates = { fail: 'node -e "console.log(\'SHOULD_NOT_RUN\');process.exit(9)"' };
      cfg.hooks = { ci: ['fail'] };
    });
    for (const args of [['cii'], ['prepush'], ['ci', 'extra'], ['pre-push', '--extra']]) {
      const result = aquila(root, 'gate', ...args);
      assert.equal(result.code, 1, result.out);
      assert.match(result.out, /invalid phase|gate arguments/);
      assert.doesNotMatch(result.out, /SHOULD_NOT_RUN/);
    }
    assert.equal(aquila(root, 'gate', 'pre-push').code, 0);
  } finally {
    cleanup(root);
  }
});

test('DA-004: pnpm parsing is limited to multiline/inline packages with comments and exclusions', () => {
  const root = project(
    {
      'package.json': '{}',
      'apps/web/package.json': '{}',
      'apps/legacy/package.json': '{}',
      'fixtures/legacy/package.json': '{}',
    },
    { node: false },
  );
  try {
    for (const yaml of [
      "packages:\n  - 'apps/*' # include\n  - '!apps/legacy'\nonlyBuiltDependencies:\n  - 'fixtures/*'\n",
      'packages: ["apps/*", "!apps/legacy"] # comment\nonlyBuiltDependencies:\n  - fixtures/*\n',
      "packages:\n- 'apps/*'\n- '!apps/legacy'\nonlyBuiltDependencies:\n- fixtures/*\n",
      "other:\n  packages:\n    - fixtures/*\npackages:\n  - apps/*\n  - '!apps/legacy'\n",
      'packages: [ "apps/*", "!apps/legacy", ]\nother: ["unterminated ignored]\n',
      '\uFEFF"packages": ["apps/*", "!apps/legacy"]\r\n',
      "'packages':\n  - apps/*\n  - '!apps/legacy'\n",
    ]) {
      writeFileSync(join(root, 'pnpm-workspace.yaml'), yaml);
      assert.deepEqual(workspaces(root), ['apps/web'], yaml);
    }
    for (const yaml of ['packages: []\n', 'onlyBuiltDependencies:\n  - fixtures/*\n']) {
      writeFileSync(join(root, 'pnpm-workspace.yaml'), yaml);
      assert.deepEqual(workspaces(root), [], yaml);
    }
    for (const yaml of [
      'packages: &pkgs [apps/*]\n',
      'packages:\n  nested: true\n',
      'packages: [apps/*\n',
      "packages: ['apps/*']\npackages: ['fixtures/*']\n",
      'packages:\n  - true\n',
      'packages:\n',
      '"packages": {nested: true}\n',
    ]) {
      writeFileSync(join(root, 'pnpm-workspace.yaml'), yaml);
      assert.throws(() => workspaces(root), /pnpm-workspace\.yaml.*packages/, yaml);
    }
  } finally {
    cleanup(root);
  }
});

test('DA-005: non-executing hooks are not proven by command text', () => {
  const root = project();
  const cfg = { hooks: { 'pre-push': ['smoke'] } };
  try {
    mkdirSync(join(root, '.husky'), { recursive: true });
    for (const script of [
      'echo "npx aquila-react-ai gate pre-push"\n',
      '# npx aquila-react-ai gate pre-push\n',
      'exit 0\nnpx aquila-react-ai gate pre-push\n',
      'false && npx aquila-react-ai gate pre-push\n',
      'if false; then\nnpx aquila-react-ai gate pre-push\nfi\n',
      'npx aquila-react-ai gate pre-push || true\n',
      'npx aquila-react-ai gate pre-commit\n',
      'f() {\nnpx aquila-react-ai gate pre-push\n}\n',
      'npx aquila-react-ai\ngate pre-push\n',
      '#!/bin/false\nnpx aquila-react-ai gate pre-push\n',
    ]) {
      writeFileSync(join(root, '.husky/pre-push'), script);
      assert.equal(hookIssues(root, cfg, '.husky/_').length, 1, script);
    }
    for (const script of [
      '#!/bin/sh\n# comment\nnpx aquila-react-ai gate pre-push\n',
      '#!/bin/sh\nexec node "./node_modules/aquila-react-ai/bin/aquila.mjs" gate pre-push\n',
      '#!/bin/sh\nexec node "$(git rev-parse --show-toplevel)/node_modules/aquila-react-ai/bin/aquila.mjs" gate pre-push\n',
      'npx --no-install aquila-react-ai gate pre-push\n',
    ]) {
      writeFileSync(join(root, '.husky/pre-push'), script);
      assert.deepEqual(hookIssues(root, cfg, '.husky/_'), [], script);
    }
    prepare(root);
    assert.deepEqual(hookIssues(root, cfg, '.aquila-hooks'), [], 'the shared dispatcher passes');
    execFileSync('git', ['config', 'core.hooksPath', '.husky/_'], { cwd: root });
    writeFileSync(join(root, '.husky/pre-push'), 'echo "npx aquila-react-ai gate pre-push"\n');
    const result = aquila(root, 'check', '--ready');
    assert.equal(result.code, 1, result.out);
    assert.match(result.out, /integration unverified/);
  } finally {
    cleanup(root);
  }
});

test('DA-006: sync/re-init reject invalid config without writing files', () => {
  const root = project({
    '.vscode/settings.json': '{"editor.tabSize":2}\n',
    '.claude/settings.json': '{"permissions":{"allow":[]}}\n',
    'docs/ai/aquila.local.json': '{"tokenLimit":987}\n',
  });
  try {
    prepare(root);
    const paths = [
      'docs/ai/aquila.json',
      'docs/ai/CONTEXT.md',
      'AGENTS.md',
      '.github/workflows/aquila-gates.yml',
      '.vscode/settings.json',
      '.claude/settings.json',
      'docs/ai/aquila.local.json',
    ];
    const valid = readIn(root, paths[0]);
    for (const bad of [
      null,
      { ...JSON.parse(valid), tools: null, lint: { level: 'off', pending: 'marker' } },
      { ...JSON.parse(valid), hooks: { ci: ['undefined-gate'] } },
    ]) {
      writeFileSync(join(root, paths[0]), JSON.stringify(bad, null, 2));
      const before = paths.map((path) => readFileSync(join(root, path)));
      for (const args of [['sync'], ['init'], ['init', '--mode=team', '--token-limit=123']]) {
        const result = aquila(root, ...args);
        assert.equal(result.code, 1, result.out);
        assert.match(result.out, /aquila\.json invalid/);
        assert.doesNotMatch(result.out, /Cannot read|TypeError/);
        assert.deepEqual(
          paths.map((path) => readFileSync(join(root, path))),
          before,
        );
      }
    }
  } finally {
    cleanup(root);
  }
});
