// Where the project sits in its git repository, and the hook dispatcher shared by every aquila package
// (aquila-ai, aquila-react-ai, aquila-next-ai). Package-agnostic on purpose: aquila-core generates this file
// and githooks/dispatcher byte-identical in the three packages, so whichever `init` runs last writes the
// same bytes.
//
// Protocol (v2; v1 was 0.2.0):
//   <repo>/.aquila-hooks/pre-commit, pre-push  the dispatcher (githooks/dispatcher); core.hooksPath = .aquila-hooks
//   <repo>/.aquila-hooks/projects              "<package> <dir>" per line; <dir> from the repo root, "." = root
//   <repo>/.aquila-hooks/.gitattributes        "* text eol=lf" (sh breaks on CRLF checkouts)
// Versioned in every mode, with mode 100755 in the index (Windows does not set the bit).
import { execFileSync } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

export const DISPATCH_DIR = '.aquila-hooks';
export const REGISTRY = `${DISPATCH_DIR}/projects`;
export const PHASES = ['pre-commit', 'pre-push'];
export const REGISTRY_HEAD =
  '# aquila projects sharing this hook dispatcher: "<package> <dir>" (dir from the repository root; "." = root).\n# Maintained by `npx <package> init|sync` of each aquila package; commit it.\n';
const ATTRIBUTES = '* text eol=lf\n';
const CONFIG = 'docs/ai/aquila.json';

const run = (cwd, ...args) => {
  try {
    return execFileSync('git', args, {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).replace(/\r?\n$/, '');
  } catch {
    return null;
  }
};
const lf = (text) => text.replaceAll('\r\n', '\n');

/**
 * { git, top, prefix, dir }: repository root, the project's path from it with a trailing slash ("" at the
 * root) and the same as a registry dir ("." at the root). Without git, the project is its own root.
 */
export function layout(root) {
  const cdup = run(root, 'rev-parse', '--show-cdup');
  if (cdup === null) return { git: false, top: root, prefix: '', dir: '.' };
  const prefix = run(root, 'rev-parse', '--show-prefix') ?? '';
  return { git: true, top: resolve(root, cdup || '.'), prefix, dir: prefix.replace(/\/$/, '') || '.' };
}

/** One registry line → { pkg, dir }; also reads 0.2.0 aquila-next-ai's "<dir>\t<package>". */
function parseLine(line) {
  const [a, ...rest] = line.trim().split(/\s+/);
  const b = rest.join(' ');
  return a.startsWith('aquila') ? { pkg: a, dir: b || '.' } : { pkg: b, dir: a };
}

/** Registry entries: [{ pkg, dir, line }], comments and blank lines ignored, CRLF tolerated. */
export function readRegistry(top) {
  const file = join(top, REGISTRY);
  if (!existsSync(file)) return [];
  return readFileSync(file, 'utf8')
    .split(/\r?\n/)
    .filter((line) => line.trim() && !line.startsWith('#'))
    .map((line) => ({ ...parseLine(line), line: line.trimEnd() }));
}

/**
 * Adds/updates this project's line. Other packages' lines are kept as written; only lines whose project is
 * gone (no docs/ai/aquila.json) leave. Sorted by dir, so the init order does not matter. True if it changed.
 */
export function register(top, pkg, dir) {
  const entries = readRegistry(top).filter(
    (e) => e.dir !== dir && existsSync(join(top, e.dir, CONFIG)),
  );
  entries.push({ pkg, dir, line: `${pkg} ${dir}` });
  entries.sort((a, b) => a.dir.localeCompare(b.dir));
  const next = `${REGISTRY_HEAD}${entries.map((e) => e.line).join('\n')}\n`;
  const file = join(top, REGISTRY);
  if (existsSync(file) && lf(readFileSync(file, 'utf8')) === next) return false;
  mkdirSync(join(top, DISPATCH_DIR), { recursive: true });
  writeFileSync(file, next);
  return true;
}

/** Dispatcher version (0.2.0 headers included); 0 when the text is not an aquila dispatcher. */
export const dispatcherVersion = (text) =>
  Number(/^# aquila-hooks (?:dispatcher )?v(\d+)\b/m.exec(text ?? '')?.[1] ?? 0);
export const isDispatcher = (text) => dispatcherVersion(text) > 0;
export const dispatcherSource = (pkgDir) =>
  lf(readFileSync(join(pkgDir, 'githooks', 'dispatcher'), 'utf8'));

/**
 * Writes the dispatcher from `pkgDir/githooks/dispatcher`, never downgrading one written by a newer aquila
 * package and never touching a hand-written hook. Returns { written, notes }.
 */
export function writeDispatcher(top, pkgDir) {
  const written = [];
  const notes = [];
  const ours = dispatcherSource(pkgDir);
  mkdirSync(join(top, DISPATCH_DIR), { recursive: true });
  const attributes = join(top, DISPATCH_DIR, '.gitattributes');
  if (!existsSync(attributes) || lf(readFileSync(attributes, 'utf8')) !== ATTRIBUTES) {
    writeFileSync(attributes, ATTRIBUTES);
    written.push('.gitattributes');
  }
  for (const phase of PHASES) {
    const file = join(top, DISPATCH_DIR, phase);
    const current = existsSync(file) ? lf(readFileSync(file, 'utf8')) : null;
    if (current !== null && !isDispatcher(current)) {
      notes.push(`! ${DISPATCH_DIR}/${phase} is not an aquila-hooks dispatcher — left untouched`);
      continue;
    }
    if (current !== ours && dispatcherVersion(ours) >= dispatcherVersion(current)) {
      writeFileSync(file, ours);
      written.push(phase);
    }
    // git ignores hooks without +x on Linux/macOS; npm tarballs and Windows checkouts drop the bit.
    chmodSync(file, 0o755);
  }
  return { written, notes };
}

/** Index mode of a path ('100755', '100644'), or null when it is not in the index. */
export const indexMode = (top, path) => run(top, 'ls-files', '-s', '--', path)?.split(' ')[0] || null;

/**
 * Records +x in the index for the hooks: on Windows (core.fileMode=false) git would version them 100644
 * and Linux/macOS clones would never run them. A file not yet in the index is added with +x.
 * Returns the paths whose index entry changed.
 */
export function stageExecutable(top, paths) {
  const changed = [];
  for (const path of paths) {
    if (!existsSync(join(top, path))) continue;
    const mode = indexMode(top, path);
    if (mode === '100755') continue;
    const ok = mode
      ? run(top, 'update-index', '--chmod=+x', '--', path)
      : run(top, 'add', '--chmod=+x', '--', path);
    if (ok !== null) changed.push(path);
  }
  return changed;
}

/** Hooks of the dispatcher (and `.gitattributes`) as repo paths. */
export const dispatcherFiles = () => [...PHASES, '.gitattributes'].map((n) => `${DISPATCH_DIR}/${n}`);

/** "x is versioned 100644" for the dispatcher hooks that are in the index without +x. */
export function indexModeIssues(top) {
  return PHASES.map((phase) => `${DISPATCH_DIR}/${phase}`)
    .filter((path) => indexMode(top, path) && indexMode(top, path) !== '100755')
    .map(
      (path) =>
        `${path} is versioned without +x (${indexMode(top, path)}): Linux/macOS clones never run it → npx <package> init (or git update-index --chmod=+x ${path})`,
    );
}

/** core.hooksPath values an aquila package set before 0.2.0 (relative to the project, wrong in subfolders). */
export const isLegacyHooksPath = (value) =>
  /(^|\/)(\.aquila\/githooks|node_modules\/aquila(?:-[\w-]+)?\/githooks)\/?$/.test(value);

/**
 * What a core.hooksPath is: 'none', 'dispatcher', 'legacy' (an aquila pre-0.2.0 path), 'missing' (a custom
 * folder that is gone or has no pre-commit/pre-push: nothing runs) or 'manager' (husky & co., hooks there).
 */
export function hooksPathKind(top, value) {
  const path = (value ?? '').split('\\').join('/').replace(/\/+$/, '');
  if (!path) return 'none';
  if (path === DISPATCH_DIR) return 'dispatcher';
  if (isLegacyHooksPath(path)) return 'legacy';
  // husky v9 sets `.husky/_` (generated wrappers); the project's scripts are in `.husky/`.
  const dir = resolve(top, path.replace(/\/_$/, ''));
  const hooks = existsSync(dir) && statSync(dir).isDirectory() ? readdirSync(dir) : [];
  return PHASES.some((phase) => hooks.includes(phase)) ? 'manager' : 'missing';
}
