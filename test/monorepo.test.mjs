// Projects that are not the git root (monorepo) and several aquila packages in one repository: the shared
// hook dispatcher (.aquila-hooks/), the CI workflow at the root, info/exclude and changed-file paths.
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmdirSync,
  rmSync,
  symlinkSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { CLI, LINK_TYPE, PKG, aquilaWithEnv } from './helpers.mjs';

const json = (o) => JSON.stringify(o, null, 2);
const write = (root, path, content) => {
  mkdirSync(dirname(join(root, path)), { recursive: true });
  writeFileSync(join(root, path), content);
};
const run = (cwd, cmd, ...args) =>
  spawnSync(cmd, args, { cwd, encoding: 'utf8', env: { ...process.env, GIT_TERMINAL_PROMPT: '0' } });
const git = (cwd, ...args) => {
  const r = run(cwd, 'git', ...args);
  return { code: r.status, out: `${r.stdout}${r.stderr}` };
};
const cli = (cwd, ...args) => aquilaWithEnv(cwd, {}, ...args);
const ran = (top) => (existsSync(join(top, 'ran.log')) ? readFileSync(join(top, 'ran.log'), 'utf8') : '');

/** Records which project ran which gate: `node <rel>/mark.cjs <label>` appends to <top>/ran.log. */
const MARK = `require('node:fs').appendFileSync(require('node:path').join(__dirname, process.argv[3] || '..', 'ran.log'), process.argv[2] + '\\n');\n`;

/** Temporary repository; `dirs` are aquila-react-ai projects ('.' = the root), installed like npm would. */
function repo(dirs, { nest = null } = {}) {
  const top = mkdtempSync(join(tmpdir(), 'aquila-mono-'));
  execFileSync('git', ['init', '-q', '-b', 'main'], { cwd: top });
  git(top, 'config', 'user.email', 'dev@example.com');
  git(top, 'config', 'user.name', 'dev');
  git(top, 'config', 'commit.gpgsign', 'false');
  write(top, '.gitignore', 'node_modules/\nran.log\n');
  for (const dir of dirs) {
    const up = dir === '.' ? '.' : dir.split('/').map(() => '..').join('/');
    write(top, `${dir}/package.json`, json({
      dependencies: { react: '^19.0.0' },
      devDependencies: { 'aquila-react-ai': '^0.2.0' },
      scripts: { test: 'node -e 0' },
    }));
    write(top, `${dir}/mark.cjs`, MARK);
    write(top, `${dir}/src/app.js`, 'export const app = 1;\n');
    mkdirSync(join(top, dir, 'node_modules'), { recursive: true });
    symlinkSync(PKG, join(top, dir, 'node_modules', 'aquila-react-ai'), LINK_TYPE);
    const label = dir === '.' ? 'root' : dir;
    const init = cli(join(top, dir), 'init', '--tools=codex', '--lint=off', '--mode=local');
    assert.equal(init.code, 0, init.out);
    const cfgPath = join(top, dir, 'docs/ai/aquila.json');
    const cfg = JSON.parse(readFileSync(cfgPath, 'utf8'));
    cfg.gates = {
      mark: `node mark.cjs "${label} pre-commit" ${up}`,
      push: `node mark.cjs "${label} pre-push" ${up}`,
    };
    cfg.hooks = { 'pre-commit': ['mark'], 'pre-push': ['push'], ci: ['mark'] };
    writeFileSync(cfgPath, json(cfg));
    assert.equal(cli(join(top, dir), 'sync').code, 0);
  }
  if (nest) {
    // A sibling aquila package (aquila-ai 0.2.0 for NestJS) registered in the same dispatcher.
    write(top, `${nest}/package.json`, json({ dependencies: { '@nestjs/core': '^11.0.0' } }));
    write(top, `${nest}/docs/ai/aquila.json`, '{}\n');
    write(top, `${nest}/src/main.ts`, 'export {};\n');
    write(
      top,
      `${nest}/node_modules/aquila-ai/bin/aquila.mjs`,
      `import { appendFileSync } from 'node:fs';\nappendFileSync('../ran.log', '${nest} ' + process.argv[3] + '\\n');\n`,
    );
    const registry = join(top, '.aquila-hooks/projects');
    writeFileSync(registry, `${readFileSync(registry, 'utf8')}aquila-ai ${nest}\n`);
  }
  assert.equal(git(top, 'add', '-A').code, 0);
  const first = git(top, 'commit', '-q', '--no-verify', '-m', 'init');
  assert.equal(first.code, 0, first.out);
  return top;
}

function cleanup(top) {
  // Unlink the package links first so the recursive delete never reaches this checkout.
  for (const dir of ['', 'frontend', 'apps/web']) {
    const link = join(top, dir, 'node_modules', 'aquila-react-ai');
    try {
      unlinkSync(link);
    } catch {
      try {
        rmdirSync(link);
      } catch {}
    }
  }
  rmSync(top, { recursive: true, force: true });
}

const commit = (top, files) => {
  for (const f of files) write(top, f, `// ${Math.random()}\n`);
  git(top, 'add', '-A');
  return git(top, 'commit', '-q', '-m', 'change');
};

test('root project: init points core.hooksPath at the shared dispatcher and the hook runs the gate', () => {
  const top = repo(['.']);
  try {
    assert.equal(git(top, 'config', '--get', 'core.hooksPath').out.trim(), '.aquila-hooks');
    assert.equal(readFileSync(join(top, '.aquila-hooks/projects'), 'utf8').match(/^[^#].*$/gm).join('\n'), 'aquila-react-ai .');
    assert.ok(existsSync(join(top, '.github/workflows/aquila-gates.yml')), 'root keeps the root workflow');
    const c = commit(top, ['src/app.js']);
    assert.equal(c.code, 0, c.out);
    assert.equal(ran(top), 'root pre-commit\n');
  } finally {
    cleanup(top);
  }
});

test('project in a subfolder: hooks, exclude and CI are anchored at the repository root', () => {
  const top = repo(['frontend']);
  try {
    assert.equal(git(top, 'config', '--get', 'core.hooksPath').out.trim(), '.aquila-hooks');
    assert.match(readFileSync(join(top, '.aquila-hooks/projects'), 'utf8'), /^aquila-react-ai frontend$/m);

    // GitHub only reads workflows at the root: one per project, scoped to its folder.
    assert.ok(!existsSync(join(top, 'frontend/.github/workflows/aquila-gates.yml')));
    const wf = readFileSync(join(top, '.github/workflows/aquila-gates-frontend.yml'), 'utf8');
    assert.match(wf, /working-directory: 'frontend'/);
    assert.match(wf, /paths:\n\s+- 'frontend\/\*\*'/);
    assert.match(wf, /name: aquila-gates-frontend/);

    // info/exclude is anchored at the repository root.
    const exclude = readFileSync(join(top, '.git/info/exclude'), 'utf8');
    assert.match(exclude, /^\/frontend\/AGENTS\.md$/m);
    assert.match(exclude, /^\/frontend\/plan\.md$/m);
    assert.equal(git(top, 'status', '--porcelain', '--', 'frontend/AGENTS.md').out, '', 'generated router ignored');

    const c = commit(top, ['frontend/src/app.js']);
    assert.equal(c.code, 0, c.out);
    assert.equal(ran(top), 'frontend pre-commit\n');

    const check = cli(join(top, 'frontend'), 'check');
    assert.equal(check.code, 0, check.out);
  } finally {
    cleanup(top);
  }
});

test('init twice is idempotent: one registry line, same dispatcher, nothing re-synced', () => {
  const top = repo(['frontend']);
  try {
    const files = ['.aquila-hooks/projects', '.aquila-hooks/pre-commit', '.aquila-hooks/pre-push', '.github/workflows/aquila-gates-frontend.yml'];
    const before = files.map((f) => readFileSync(join(top, f), 'utf8'));
    const again = cli(join(top, 'frontend'), 'init');
    assert.equal(again.code, 0, again.out);
    assert.deepEqual(files.map((f) => readFileSync(join(top, f), 'utf8')), before);
    assert.equal(git(top, 'status', '--porcelain').out, '', 'second init changes nothing versioned');
  } finally {
    cleanup(top);
  }
});

test('NestJS backend + React frontend: each commit and push runs only the touched projects', () => {
  const top = repo(['frontend'], { nest: 'backend' });
  const remote = mkdtempSync(join(tmpdir(), 'aquila-remote-'));
  try {
    assert.equal(commit(top, ['backend/src/main.ts']).code, 0);
    assert.equal(ran(top), 'backend pre-commit\n', 'only the backend');
    rmSync(join(top, 'ran.log'));
    assert.equal(commit(top, ['frontend/src/app.js']).code, 0);
    assert.equal(ran(top), 'frontend pre-commit\n', 'only the frontend');
    rmSync(join(top, 'ran.log'));
    assert.equal(commit(top, ['backend/src/main.ts', 'frontend/src/app.js']).code, 0);
    assert.deepEqual(ran(top).trim().split('\n').sort(), ['backend pre-commit', 'frontend pre-commit']);
    rmSync(join(top, 'ran.log'));
    assert.equal(commit(top, ['README.md']).code, 0);
    assert.equal(ran(top), '', 'a file outside every project runs no gate');

    // pre-push: a new branch runs every project; then only what the pushed commits touched.
    execFileSync('git', ['init', '-q', '--bare'], { cwd: remote });
    git(top, 'remote', 'add', 'origin', remote);
    const first = git(top, 'push', '-q', 'origin', 'main');
    assert.equal(first.code, 0, first.out);
    assert.deepEqual(ran(top).trim().split('\n').sort(), ['backend pre-push', 'frontend pre-push']);
    rmSync(join(top, 'ran.log'));
    commit(top, ['frontend/src/app.js']);
    rmSync(join(top, 'ran.log'));
    const second = git(top, 'push', '-q', 'origin', 'main');
    assert.equal(second.code, 0, second.out);
    assert.equal(ran(top), 'frontend pre-push\n');

    // The other package's registry line survives our sync.
    assert.equal(cli(join(top, 'frontend'), 'sync').code, 0);
    assert.match(readFileSync(join(top, '.aquila-hooks/projects'), 'utf8'), /^aquila-ai backend$/m);
  } finally {
    rmSync(remote, { recursive: true, force: true });
    cleanup(top);
  }
});

test('a failing gate blocks the commit; a project without its package installed fails loudly', () => {
  const top = repo(['frontend']);
  try {
    const cfgPath = join(top, 'frontend/docs/ai/aquila.json');
    const cfg = JSON.parse(readFileSync(cfgPath, 'utf8'));
    cfg.gates.mark = 'node -e "process.exit(3)"';
    writeFileSync(cfgPath, json(cfg));
    assert.notEqual(commit(top, ['frontend/src/app.js']).code, 0, 'gate failure propagates');
    git(top, 'reset', '-q', '--hard');

    unlinkSync(join(top, '.aquila-hooks/projects'));
    const missing = commit(top, ['frontend/src/app.js']);
    assert.notEqual(missing.code, 0);
    assert.match(missing.out, /\.aquila-hooks\/projects missing/);
  } finally {
    cleanup(top);
  }
});

test('check fails when the hook or the workflow are where git/GitHub never look', () => {
  const top = repo(['frontend']);
  const front = join(top, 'frontend');
  try {
    // 0.1.0 set a project-relative hooksPath: git resolves it from the root, so nothing runs.
    git(top, 'config', 'core.hooksPath', '.aquila/githooks');
    const hook = cli(front, 'check');
    assert.equal(hook.code, 1, hook.out);
    assert.match(hook.out, /core\.hooksPath \.aquila\/githooks/);
    assert.equal(cli(front, 'sync').code, 0);
    assert.equal(git(top, 'config', '--get', 'core.hooksPath').out.trim(), '.aquila-hooks', 'sync migrates it');

    // A generated workflow inside the subfolder is never read by GitHub.
    write(top, 'frontend/.github/workflows/aquila-gates.yml', '# Generated by `npx aquila-react-ai sync` from docs/ai/aquila.json\nname: aquila-gates\n');
    const wf = cli(front, 'check');
    assert.equal(wf.code, 1, wf.out);
    assert.match(wf.out, /frontend\/\.github\/workflows\/aquila-gates\.yml.*GitHub/);
    assert.equal(cli(front, 'sync').code, 0);
    assert.ok(!existsSync(join(front, '.github/workflows/aquila-gates.yml')), 'sync removes it');

    // This project missing from the registry: the dispatcher would skip it.
    writeFileSync(join(top, '.aquila-hooks/projects'), '');
    const reg = cli(front, 'check');
    assert.equal(reg.code, 1, reg.out);
    assert.match(reg.out, /not registered in \.aquila-hooks\/projects/);
  } finally {
    cleanup(top);
  }
});

test('doctor reports the subfolder, the dispatcher, the bin, the workflow and sibling packages', () => {
  const top = repo(['frontend'], { nest: 'backend' });
  try {
    const { out } = cli(join(top, 'frontend'), 'doctor');
    assert.match(out, /project in subfolder frontend\//);
    assert.match(out, /✓ git hooks: \.aquila-hooks \(shared dispatcher\)/);
    assert.match(out, /✓ hook finds frontend\/node_modules\/aquila-react-ai\/bin\/aquila\.mjs/);
    assert.match(out, /✓ CI workflow \.github\/workflows\/aquila-gates-frontend\.yml/);
    assert.match(out, /aquila projects in this repository: aquila-ai backend · aquila-react-ai frontend/);
  } finally {
    cleanup(top);
  }
});

test('gate ci in a subfolder filters `when` globs relative to the project, not the repository', () => {
  const top = repo(['frontend']);
  const front = join(top, 'frontend');
  try {
    const cfgPath = join(front, 'docs/ai/aquila.json');
    const cfg = JSON.parse(readFileSync(cfgPath, 'utf8'));
    cfg.gates.e2e = { cmd: 'node -e 0', when: ['src/**'] };
    cfg.hooks.ci = ['e2e'];
    writeFileSync(cfgPath, json(cfg));
    git(top, 'add', '-A');
    git(top, 'commit', '-q', '--no-verify', '-m', 'cfg');
    const before = git(top, 'rev-parse', 'HEAD').out.trim();
    write(top, 'frontend/src/app.js', 'export const app = 2;\n');
    git(top, 'add', '-A');
    git(top, 'commit', '-q', '--no-verify', '-m', 'src');
    const after = git(top, 'rev-parse', 'HEAD').out.trim();
    const event = join(top, 'event.json');
    writeFileSync(event, json({ before, after }));
    const r = aquilaWithEnv(front, { GITHUB_EVENT_PATH: event, GITHUB_SHA: after }, 'gate', 'ci');
    assert.equal(r.code, 0, r.out);
    assert.match(r.out, /✓ e2e/);
    assert.doesNotMatch(r.out, /↷ e2e/);
  } finally {
    cleanup(top);
  }
});

test('the dispatcher is package-neutral: same bytes for every aquila package', () => {
  const text = readFileSync(join(PKG, 'githooks/pre-commit'), 'utf8');
  assert.equal(readFileSync(join(PKG, 'githooks/pre-push'), 'utf8'), text, 'one script, phase from its name');
  assert.match(text, /^#!\/bin\/sh\n# aquila-hooks v1\b/);
  assert.doesNotMatch(text.replace(/^#.*$/gm, ''), /aquila-react-ai|aquila-ai|aquila-next-ai/, 'no package name in code');
  assert.ok(!text.includes('\r\n'), 'sh breaks with CRLF');
  assert.ok(CLI);
});
