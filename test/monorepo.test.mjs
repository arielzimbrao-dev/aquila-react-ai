// Monorepo / project in a subfolder: hooks, core.hooksPath, CI workflow and git exclude are anchored at the
// repository root, and every aquila package shares one hook dispatcher (.aquila-hooks/, protocol v2). The
// commits below run the real hooks through git's own `sh` (Git Bash on Windows, /bin/sh on Linux/macOS).
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmdirSync,
  rmSync,
  statSync,
  symlinkSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { PROFILE } from '../bin/profile.mjs';
import { aquila, editConfig, git, LINK_TYPE, NAME, PKG } from './helpers.mjs';

const write = (root, path, content) => {
  mkdirSync(dirname(join(root, path)), { recursive: true });
  writeFileSync(join(root, path), content);
};
const read = (root, path) => readFileSync(join(root, path), 'utf8');
const DISPATCHER = read(PKG, 'githooks/dispatcher');
const MARK = "require('fs').appendFileSync(require('path').join(process.cwd(), '..', 'hooks.log'), process.argv[2] + '\\n');";
// Another aquila package (a different stack) in the same repository; its name only matters to the registry.
const SIBLING = NAME === 'aquila-ai' ? 'aquila-react-ai' : 'aquila-ai';

function repo() {
  const top = mkdtempSync(join(tmpdir(), 'aquila-mono-'));
  execFileSync('git', ['init', '-q', '-b', 'main'], { cwd: top });
  git(top, 'config', 'user.email', 'test@example.com');
  git(top, 'config', 'user.name', 'test');
  git(top, 'config', 'core.autocrlf', 'false');
  return top;
}

/** A project of this package's stack in <top>/<dir>, the package linked in its node_modules. */
function project(top, dir) {
  const root = join(top, dir);
  mkdirSync(join(root, 'node_modules'), { recursive: true });
  symlinkSync(PKG, join(root, 'node_modules', NAME), LINK_TYPE);
  write(root, 'package.json', JSON.stringify({
    dependencies: { [PROFILE.framework]: PROFILE.frameworkRange },
    devDependencies: { [NAME]: '^0.3.0' },
    scripts: { test: 'node mark.js test' },
  }));
  write(root, 'mark.js', MARK.replace("'..'", `'${dir === '.' ? '.' : '..'}'`));
  write(root, 'src/app.ts', 'export {};\n');
  return root;
}

const markGates = (root, name) => {
  editConfig(root, (cfg) => {
    cfg.gates = { mark: `node mark.js ${name}` };
    cfg.hooks = { 'pre-commit': ['mark'], 'pre-push': ['mark'], ci: ['mark'] };
  });
  assert.equal(aquila(root, 'sync').code, 0);
};

/** The sibling package as its own init leaves things: its bin (a recorder), the dispatcher, its registry line. */
function sibling(top, line = `${SIBLING} frontend`) {
  const bin = join(top, 'frontend', 'node_modules', SIBLING, 'bin', 'aquila.mjs');
  write(top, 'frontend/src/App.tsx', 'export {};\n');
  write(top, 'frontend/package.json', '{}');
  write(top, 'frontend/docs/ai/aquila.json', '{}');
  mkdirSync(dirname(bin), { recursive: true });
  writeFileSync(
    bin,
    "import { appendFileSync } from 'node:fs';\nimport { join } from 'node:path';\nappendFileSync(join(process.cwd(), '..', 'hooks.log'), `frontend ${process.argv.slice(2).join(' ')}\\n`);\n",
  );
  for (const phase of ['pre-commit', 'pre-push']) {
    write(top, `.aquila-hooks/${phase}`, DISPATCHER);
    chmodSync(join(top, `.aquila-hooks/${phase}`), 0o755);
  }
  write(top, '.aquila-hooks/projects', `# written by the sibling\n${line}\n`);
  git(top, 'config', 'core.hooksPath', '.aquila-hooks');
}

const commit = (top, ...paths) => {
  for (const path of paths) write(top, path, `${Date.now()}${Math.random()}\n`);
  rmSync(join(top, 'hooks.log'), { force: true });
  assert.equal(spawnSync('git', ['add', '-A'], { cwd: top }).status, 0);
  const c = spawnSync('git', ['commit', '-q', '-m', paths.join(' ')], { cwd: top, encoding: 'utf8' });
  assert.equal(c.status, 0, `${c.stdout}${c.stderr}`);
  return existsSync(join(top, 'hooks.log')) ? read(top, 'hooks.log').trim().split('\n').sort() : [];
};

const unlinkAll = (top) => {
  for (const dir of ['.', 'backend'])
    for (const fn of [unlinkSync, rmdirSync])
      try {
        fn(join(top, dir, 'node_modules', NAME));
        break;
      } catch {}
  rmSync(top, { recursive: true, force: true });
};

test('project at the repository root: dispatcher v2, registry line, the commit runs the gate', () => {
  const top = repo();
  try {
    const root = project(top, '.');
    assert.equal(aquila(root, 'init', '--tools=codex', '--lint=off').code, 0);
    markGates(root, 'root');
    assert.equal(git(top, 'config', '--get', 'core.hooksPath'), '.aquila-hooks');
    assert.match(read(top, '.aquila-hooks/projects'), new RegExp(`^${NAME} \\.$`, 'm'));
    assert.equal(read(top, '.aquila-hooks/pre-commit'), DISPATCHER);
    assert.match(DISPATCHER.split('\n')[1], /^# aquila-hooks v2 \(aquila-hooks dispatcher v2\)/);
    assert.ok(!existsSync(join(root, '.aquila/githooks')), 'hooks never live in .aquila');
    assert.ok(existsSync(join(top, '.github/workflows/aquila-gates.yml')));
    assert.deepEqual(commit(top, 'src/app.ts'), ['root']);
    // Versioned with +x even on Windows (core.fileMode=false), or Linux/macOS clones never run them.
    for (const phase of ['pre-commit', 'pre-push'])
      assert.match(git(top, 'ls-files', '-s', `.aquila-hooks/${phase}`), /^100755 /);
    assert.equal(aquila(root, 'check').code, 0);
  } finally {
    unlinkAll(top);
  }
});

test('project in repo/backend: hooks, CI workflow, exclude, Copilot and VS Code anchored at the repo root', () => {
  const top = repo();
  try {
    const root = project(top, 'backend');
    const init = aquila(root, 'init', '--tools=copilot,claude,codex', '--lint=off');
    assert.equal(init.code, 0, init.out);
    markGates(root, 'backend');
    assert.match(read(top, '.aquila-hooks/projects'), new RegExp(`^${NAME} backend$`, 'm'));
    assert.equal(read(top, '.aquila-hooks/.gitattributes'), '* text eol=lf\n');
    if (process.platform !== 'win32')
      assert.ok(statSync(join(top, '.aquila-hooks/pre-commit')).mode & 0o111);
    assert.ok(!existsSync(join(root, '.github/workflows/aquila-gates.yml')), 'never inside the subfolder');
    const wf = read(top, '.github/workflows/aquila-gates-backend.yml');
    assert.match(wf, /working-directory: 'backend'/);
    assert.match(wf, /paths:\n\s+- 'backend\/\*\*'\n\s+- '\.github\/workflows\/aquila-gates-backend\.yml'/);
    const exclude = read(top, '.git/info/exclude');
    assert.match(exclude, /^\/backend\/AGENTS\.md$/m);
    assert.doesNotMatch(exclude, /^\/AGENTS\.md$/m);
    assert.match(exclude, /^\/\.vscode\/settings\.json$/m, 'the root VS Code settings are local in local mode');
    // Copilot reads .github/ only at the root: a root instructions file scoped to backend/**.
    const copilot = read(top, '.github/instructions/aquila-backend.instructions.md');
    assert.match(copilot, /^---\napplyTo: 'backend\/\*\*'\n---/);
    assert.match(copilot, /\]\(\.\.\/\.\.\/backend\/AGENTS\.md\)/);
    assert.match(read(top, '.vscode/settings.json'), /backend\/\.aquila\/skills/);
    assert.deepEqual(commit(top, 'backend/src/app.ts'), ['backend']);
    assert.deepEqual(commit(top, 'README.md'), [], 'changes outside backend/ run nothing');
    const check = aquila(root, 'check');
    assert.equal(check.code, 0, check.out);
    const doctor = aquila(root, 'doctor').out;
    assert.match(doctor, /subfolder backend\/ of the git repository/);
    assert.match(doctor, /✓ git hooks: \.aquila-hooks \(dispatcher; this project registered; hook finds backend\/node_modules/);
  } finally {
    unlinkAll(top);
  }
});

test('init twice is idempotent; sync with ci.workflow false removes the workflow and does not recreate it', () => {
  const top = repo();
  try {
    const root = project(top, 'backend');
    assert.equal(aquila(root, 'init', '--tools=codex', '--lint=off').code, 0);
    const files = ['.aquila-hooks/projects', '.aquila-hooks/pre-commit', '.git/info/exclude'];
    const before = files.map((f) => read(top, f));
    assert.equal(aquila(root, 'init').code, 0);
    assert.deepEqual(files.map((f) => read(top, f)), before);
    assert.equal(aquila(root, 'sync').out.trim(), '✓ adapters already in sync');
    editConfig(root, (cfg) => {
      cfg.ci.workflow = false;
    });
    assert.match(aquila(root, 'sync').out, /removed \.\.\/\.github\/workflows\/aquila-gates-backend\.yml \(ci\.workflow: false\)/);
    assert.equal(aquila(root, 'sync').out.trim(), '✓ adapters already in sync');
    assert.ok(!existsSync(join(top, '.github/workflows/aquila-gates-backend.yml')));
    const doctor = aquila(root, 'doctor').out;
    assert.doesNotMatch(doctor, /adapters missing/);
    assert.match(doctor, new RegExp(`ci\\.workflow false — your pipeline must run[\\s\\S]*npx ${NAME} gate ci`));
    assert.equal(aquila(root, 'check').code, 0);
  } finally {
    unlinkAll(top);
  }
});

for (const [format, line] of [
  ['"<package> <dir>"', `${SIBLING} frontend`],
  ['0.2.0 aquila-next-ai "<dir>\\t<package>"', `frontend\t${SIBLING}`],
])
  test(`with a sibling package (${format}): one dispatcher, each project runs only on its own changes`, () => {
    const top = repo();
    try {
      sibling(top, line);
      const root = project(top, 'backend');
      const init = aquila(root, 'init', '--tools=codex', '--lint=off');
      assert.equal(init.code, 0, init.out);
      assert.doesNotMatch(init.out, /hook manager already exists|not an aquila-hooks dispatcher/);
      markGates(root, 'backend');
      const projects = read(top, '.aquila-hooks/projects');
      assert.ok(projects.includes(`${line}\n`), "the sibling's line is kept as written");
      assert.match(projects, new RegExp(`^${NAME} backend$`, 'm'));
      git(top, 'add', '-A');
      git(top, 'commit', '-q', '--no-verify', '-m', 'baseline');
      assert.deepEqual(commit(top, 'backend/src/app.ts'), ['backend']);
      assert.deepEqual(commit(top, 'frontend/src/App.tsx'), ['frontend gate pre-commit']);
      assert.deepEqual(commit(top, 'backend/src/app.ts', 'frontend/src/App.tsx'), ['backend', 'frontend gate pre-commit']);
      const remote = mkdtempSync(join(tmpdir(), 'aquila-remote-'));
      try {
        execFileSync('git', ['init', '-q', '--bare', remote]);
        git(top, 'remote', 'add', 'origin', remote);
        assert.equal(spawnSync('git', ['push', '-q', 'origin', 'main'], { cwd: top }).status, 0);
        commit(top, 'frontend/src/App.tsx');
        rmSync(join(top, 'hooks.log'), { force: true });
        const push = spawnSync('git', ['push', '-q', 'origin', 'main'], { cwd: top, encoding: 'utf8' });
        assert.equal(push.status, 0, `${push.stdout}${push.stderr}`);
        assert.deepEqual(read(top, 'hooks.log').trim().split('\n'), ['frontend gate pre-push']);
      } finally {
        rmSync(remote, { recursive: true, force: true });
      }
      assert.match(aquila(root, 'doctor').out, /2 aquila projects share \.aquila-hooks/);
    } finally {
      unlinkAll(top);
    }
  });

test('a 0.2.0 dispatcher (v1) is upgraded; a hand-written hook in .aquila-hooks is left alone', () => {
  const top = repo();
  try {
    const root = project(top, 'backend');
    write(top, '.aquila-hooks/pre-commit', '#!/bin/sh\n# aquila-hooks dispatcher v1 — old\nexit 0\n');
    write(top, '.aquila-hooks/pre-push', '#!/bin/sh\necho mine\n');
    const init = aquila(root, 'init', '--tools=codex', '--lint=off');
    assert.equal(read(top, '.aquila-hooks/pre-commit'), DISPATCHER);
    assert.equal(read(top, '.aquila-hooks/pre-push'), '#!/bin/sh\necho mine\n');
    assert.match(init.out, /\.aquila-hooks\/pre-push is not an aquila-hooks dispatcher — left untouched/);
  } finally {
    unlinkAll(top);
  }
});

test('core.hooksPath pointing to a folder that is gone: init migrates it; a real manager is kept', () => {
  const top = repo();
  try {
    const root = project(top, 'backend');
    git(top, 'config', 'core.hooksPath', '.githooks');
    const init = aquila(root, 'init', '--tools=codex', '--lint=off');
    assert.equal(git(top, 'config', '--get', 'core.hooksPath'), '.aquila-hooks');
    assert.match(init.out, /was \.githooks: that folder is gone or has no pre-commit\/pre-push/);
    write(top, '.husky/pre-commit', '#!/bin/sh\nnpx lint-staged\n');
    git(top, 'config', 'core.hooksPath', '.husky');
    const kept = aquila(root, 'init');
    assert.equal(git(top, 'config', '--get', 'core.hooksPath'), '.husky');
    assert.match(kept.out, /a hook manager already exists \(\.husky\) — kept/);
    assert.equal(aquila(root, 'init', '--hooks=dispatcher').code, 0);
    assert.equal(git(top, 'config', '--get', 'core.hooksPath'), '.aquila-hooks');
  } finally {
    unlinkAll(top);
  }
});

test('check fails when a hook is versioned without +x, the 0.1.0 layout or an unregistered project', () => {
  const top = repo();
  try {
    const root = project(top, 'backend');
    assert.equal(aquila(root, 'init', '--tools=codex', '--lint=off').code, 0);
    assert.equal(aquila(root, 'check').code, 0);
    git(top, 'update-index', '--chmod=-x', '.aquila-hooks/pre-push');
    const mode = aquila(root, 'check');
    assert.equal(mode.code, 1);
    assert.match(mode.out, new RegExp(`\\.aquila-hooks/pre-push is versioned without \\+x \\(100644\\)[^\\n]*npx ${NAME} init`));
    assert.equal(aquila(root, 'init').code, 0);
    assert.match(git(top, 'ls-files', '-s', '.aquila-hooks/pre-push'), /^100755 /);
    git(top, 'config', 'core.hooksPath', '.aquila/githooks');
    assert.match(aquila(root, 'check').out, /core\.hooksPath \.aquila\/githooks: pre-0\.2\.0 hook layout/);
    assert.equal(aquila(root, 'init').code, 0);
    write(top, '.aquila-hooks/projects', '# <package> <dir>\n');
    assert.match(aquila(root, 'check').out, /backend is not in \.aquila-hooks\/projects/);
  } finally {
    unlinkAll(top);
  }
});

test('check --ready accepts a hook manager that calls the dispatcher or `cd <dir> && npx <package> gate`', () => {
  const top = repo();
  try {
    const root = project(top, 'backend');
    assert.equal(aquila(root, 'init', '--tools=codex', '--lint=off').code, 0);
    markGates(root, 'backend');
    write(top, '.husky/pre-commit', `#!/bin/sh\ncd backend && npx ${NAME} gate pre-commit\n`);
    write(top, '.husky/pre-push', '#!/bin/sh\n"$(git rev-parse --show-toplevel)/.aquila-hooks/pre-push" "$@"\n');
    git(top, 'config', 'core.hooksPath', '.husky');
    const ready = aquila(root, 'check', '--ready').out;
    assert.doesNotMatch(ready, /in a directly verifiable way/);
  } finally {
    unlinkAll(top);
  }
});

test('the dispatcher finds a package hoisted to the repository root (npm workspaces)', () => {
  const top = repo();
  try {
    const root = project(top, 'backend');
    assert.equal(aquila(root, 'init', '--tools=codex', '--lint=off').code, 0);
    markGates(root, 'backend');
    unlinkSync(join(root, 'node_modules', NAME));
    mkdirSync(join(top, 'node_modules'), { recursive: true });
    symlinkSync(PKG, join(top, 'node_modules', NAME), LINK_TYPE);
    try {
      assert.deepEqual(commit(top, 'backend/src/app.ts'), ['backend']);
    } finally {
      for (const fn of [unlinkSync, rmdirSync])
        try {
          fn(join(top, 'node_modules', NAME));
          break;
        } catch {}
    }
  } finally {
    rmSync(top, { recursive: true, force: true });
  }
});

test('ci.services and ci.env go into the generated workflow', () => {
  const top = repo();
  try {
    const root = project(top, 'backend');
    assert.equal(aquila(root, 'init', '--tools=codex', '--lint=off').code, 0);
    editConfig(root, (cfg) => {
      cfg.ci.services = {
        postgres: { image: 'postgres:16', env: { POSTGRES_PASSWORD: 'postgres' }, ports: ['5432:5432'], options: '--health-cmd pg_isready' },
      };
      cfg.ci.env = { DATABASE_URL: 'postgres://postgres:postgres@localhost:5432/postgres' };
    });
    assert.equal(aquila(root, 'sync').code, 0);
    const wf = read(top, '.github/workflows/aquila-gates-backend.yml');
    assert.match(wf, /    services:\n      postgres:\n        image: 'postgres:16'\n        env:\n          POSTGRES_PASSWORD: 'postgres'\n        ports:\n          - '5432:5432'\n        options: '--health-cmd pg_isready'\n    env:\n      DATABASE_URL: 'postgres:\/\/postgres:postgres@localhost:5432\/postgres'\n    steps:/);
    assert.match(wf, new RegExp(`run: npx ${NAME} gate ci`));
  } finally {
    unlinkAll(top);
  }
});

test('CI `when` filters compare paths relative to the project, not the repository root', () => {
  const top = repo();
  try {
    const root = project(top, 'backend');
    assert.equal(aquila(root, 'init', '--tools=codex', '--lint=off').code, 0);
    editConfig(root, (cfg) => {
      cfg.gates = { scoped: { cmd: 'node -e 0', when: ['src/**'] } };
      cfg.hooks = { ci: ['scoped'] };
    });
    git(top, 'add', '-A');
    git(top, 'commit', '-q', '--no-verify', '-m', 'base');
    const base = git(top, 'rev-parse', 'HEAD');
    write(root, 'src/app.ts', 'changed\n');
    git(top, 'add', '-A');
    git(top, 'commit', '-q', '--no-verify', '-m', 'head');
    const head = git(top, 'rev-parse', 'HEAD');
    const event = join(top, 'event.json');
    writeFileSync(event, JSON.stringify({ before: base, after: head }));
    const r = spawnSync(process.execPath, [join(PKG, 'bin', 'aquila.mjs'), 'gate', 'ci'], {
      cwd: root,
      env: { ...process.env, AQUILA_ROOT: root, GITHUB_EVENT_PATH: event, GITHUB_SHA: head },
      encoding: 'utf8',
    });
    assert.equal(r.status, 0, r.stdout);
    assert.match(r.stdout, /✓ scoped/);
  } finally {
    unlinkAll(top);
  }
});
