// CLI test utilities. Each test creates a temporary project with aquila-react-ai linked at
// node_modules/aquila-react-ai and runs the real CLI against it. Tests are split per file so `node --test`
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

export const PKG = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const CLI = join(PKG, 'bin', 'aquila.mjs');
export const LINK_TYPE = process.platform === 'win32' ? 'junction' : 'dir';

export function project(files = {}, { node = true } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'aquila-'));
  execFileSync('git', ['init', '-q'], { cwd: root });
  mkdirSync(join(root, 'node_modules'));
  symlinkSync(PKG, join(root, 'node_modules', 'aquila-react-ai'), LINK_TYPE);
  if (node) writePackage(root);
  for (const [path, content] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), content);
  }
  return root;
}

export function writePackage(root) {
  const pkg = {
    dependencies: { react: '^19.0.0' },
    scripts: {
      typecheck: 'tsc --noEmit',
      test: 'jest',
      'lint:ci': 'eslint .',
      'test:cov': 'jest --coverage',
    },
  };
  writeFileSync(join(root, 'package.json'), JSON.stringify(pkg));
}

/** Declares aquila-react-ai as a devDependency (what makes the project "installed" for CI). */
export function install(root) {
  const file = join(root, 'package.json');
  const pkg = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : {};
  pkg.devDependencies = { ...pkg.devDependencies, 'aquila-react-ai': '^0.1.0' };
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
  const link = join(root, 'node_modules', 'aquila-react-ai');
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
