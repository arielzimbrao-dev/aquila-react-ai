// CLI test utilities. Each test creates a temporary project with this package (bin/profile.mjs) linked at
// node_modules/<package> and runs the real CLI against it. Tests are split per file so `node --test`
// runs them in parallel processes (the CLI's synchronous spawns dominate the time).
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
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PROFILE } from '../bin/profile.mjs';

/** This package's npm name and the dependency that marks a project of its stack. */
export const NAME = PROFILE.pkg;
export const FRAMEWORK = PROFILE.framework;

export const PKG = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const CLI = join(PKG, 'bin', 'aquila.mjs');
export const LINK_TYPE = process.platform === 'win32' ? 'junction' : 'dir';

export function project(files = {}, { node = true } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'aquila-'));
  execFileSync('git', ['init', '-q'], { cwd: root });
  mkdirSync(join(root, 'node_modules'));
  symlinkSync(PKG, join(root, 'node_modules', NAME), LINK_TYPE);
  if (node) writePackage(root);
  for (const [path, content] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), content);
  }
  return root;
}

export function writePackage(root) {
  const pkg = {
    dependencies: { [FRAMEWORK]: PROFILE.frameworkRange },
    scripts: {
      typecheck: 'tsc --noEmit',
      test: 'jest',
      'lint:ci': 'eslint .',
      'test:cov': 'jest --coverage',
    },
  };
  writeFileSync(join(root, 'package.json'), JSON.stringify(pkg));
}

/** Declares the package as a devDependency (what makes the project "installed" for CI). */
export function install(root) {
  const file = join(root, 'package.json');
  const pkg = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : {};
  pkg.devDependencies = { ...pkg.devDependencies, [NAME]: '^0.1.0' };
  writeFileSync(file, JSON.stringify(pkg));
}

export function aquila(root, ...args) {
  return aquilaWithEnv(root, {}, ...args);
}

export function aquilaWithEnv(root, extraEnv, ...args) {
  const r = spawnSync(process.execPath, [CLI, ...args], {
    cwd: root,
    env: { ...process.env, AQUILA_ROOT: root, ...extraEnv },
    encoding: 'utf8',
  });
  return { code: r.status, out: `${r.stdout}${r.stderr}` };
}

export const readIn = (root, path) => readFileSync(join(root, path), 'utf8');
export const editConfig = (root, fn) => {
  const cfg = JSON.parse(readIn(root, 'docs/ai/aquila.json'));
  fn(cfg);
  writeFileSync(join(root, 'docs/ai/aquila.json'), JSON.stringify(cfg, null, 2));
};
export const cleanup = (root) => {
  // Remove the package link first so the recursive delete can never reach the repository.
  const link = join(root, 'node_modules', NAME);
  try {
    unlinkSync(link);
  } catch {
    try {
      rmdirSync(link);
    } catch {}
  }
  rmSync(root, { recursive: true, force: true });
};
export const git = (root, ...args) => {
  try {
    return execFileSync('git', args, {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return '';
  }
};

/**
 * Real-ESLint workspace (lint-real tests): a git repository whose root node_modules is `deps`'s (hoisted, as
 * in npm workspaces), with the project in app/ and this package linked in app/node_modules.
 */
export function lintWorkspace(deps, files) {
  const top = mkdtempSync(join(deps ?? '.', 'repo-'));
  execFileSync('git', ['init', '-q'], { cwd: top });
  symlinkSync(join(deps, 'node_modules'), join(top, 'node_modules'), LINK_TYPE);
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

export function dropWorkspace(top) {
  for (const link of [join(top, 'node_modules'), join(top, 'app', 'node_modules', NAME)])
    try {
      unlinkSync(link);
    } catch {}
  rmSync(top, { recursive: true, force: true });
}
