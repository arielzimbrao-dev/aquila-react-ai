import { existsSync, lstatSync, readdirSync, readFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { globToRegex } from './glob.mjs';
import { addLintGate, missingTool } from './lint.mjs';

const PKG = join(dirname(fileURLToPath(import.meta.url)), '..');
const SKIP_DIRS = new Set([
  'node_modules',
  '.git',
  'dist',
  'build',
  'coverage',
]);
const read = (root, file) => readFileSync(join(root, file), 'utf8');
const readJson = (root, file) => JSON.parse(read(root, file));

function expandDirs(root, pattern) {
  const directory = (path) => {
    if (!existsSync(path)) return false;
    const stat = lstatSync(path);
    return !stat.isSymbolicLink() && stat.isDirectory();
  };
  let current = [''];
  for (const seg of pattern.replace(/^\.\//, '').replace(/\/+$/, '').split('/')) {
    const next = [];
    for (const dir of current) {
      const full = join(root, dir);
      if (!directory(full)) continue;
      if (seg === '**') {
        const pending = [dir];
        while (pending.length) {
          const d = pending.pop();
          next.push(d);
          for (const n of readdirSync(join(root, d)).sort().reverse()) {
            const child = d ? `${d}/${n}` : n;
            if (!SKIP_DIRS.has(n) && directory(join(root, child))) pending.push(child);
          }
        }
      } else if (seg.includes('*')) {
        const re = globToRegex(seg);
        for (const n of readdirSync(full).sort()) {
          const child = dir ? `${dir}/${n}` : n;
          if (!SKIP_DIRS.has(n) && re.test(n) && directory(join(root, child))) next.push(child);
        }
      } else {
        const child = dir ? `${dir}/${seg}` : seg;
        if (directory(join(root, child))) next.push(child);
      }
    }
    current = next;
  }
  return current.filter(Boolean);
}

/** Explicit YAML subset: root `packages`, a block or inline list of strings. */
function pnpmPackages(text) {
  const invalid = () => {
    throw new Error(
      'pnpm-workspace.yaml: unsupported packages — use a plain list of strings (block or inline), no aliases/tags',
    );
  };
  const uncomment = (line) => {
    let quote = '';
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (quote === '"' && c === '\\') {
        i++;
      } else if (quote && c === quote) {
        if (quote === "'" && line[i + 1] === "'") i++;
        else quote = '';
      } else if (!quote && (c === "'" || c === '"')) quote = c;
      else if (!quote && c === '#' && (i === 0 || /\s/.test(line[i - 1])))
        return line.slice(0, i).trimEnd();
    }
    if (quote) invalid();
    return line.trimEnd();
  };
  const scalar = (raw) => {
    const value = raw.trim();
    if (/^'(?:[^']|'')*'$/.test(value)) return value.slice(1, -1).replaceAll("''", "'");
    if (/^"(?:[^"\\]|\\.)*"$/.test(value)) {
      try {
        return JSON.parse(value);
      } catch {
        invalid();
      }
    }
    if (
      !value ||
      /^[!&*>{[|%@`]/.test(value) ||
      /['"\t]|:\s|[}\]]$/.test(value) ||
      /^(?:null|true|false|~|[-+]?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?)$/i.test(value)
    )
      invalid();
    return value;
  };
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/);
  const key = /^(?:packages|'packages'|"packages")\s*:/;
  const keys = lines.flatMap((line, i) => (key.test(line) ? [i] : []));
  if (!keys.length) return [];
  if (keys.length > 1) invalid();
  const index = keys[0];
  const head = uncomment(lines[index].replace(key, '')).trim();
  if (head) {
    if (!head.startsWith('[') || !head.endsWith(']')) invalid();
    const body = head.slice(1, -1);
    if (!body.trim()) return [];
    const values = [];
    const token = /\s*('(?:[^']|'')*'|"(?:[^"\\]|\\.)*"|[^,'"[\]]+)\s*(,|$)/y;
    let offset = 0;
    while (offset < body.length) {
      token.lastIndex = offset;
      const match = token.exec(body);
      if (!match) invalid();
      values.push(scalar(match[1]));
      offset = token.lastIndex;
      if (!match[2] || !body.slice(offset).trim()) break;
    }
    return values;
  }
  const values = [];
  let indentation;
  for (const raw of lines.slice(index + 1)) {
    if (!raw.trim() || /^\s*#/.test(raw)) continue;
    if (/^\S/.test(raw) && !raw.startsWith('- ')) break;
    const line = uncomment(raw);
    const match = /^( *)-\s+(.+)$/.exec(line);
    if (!match) invalid();
    indentation ??= match[1].length;
    if (match[1].length !== indentation) invalid();
    values.push(scalar(match[2]));
  }
  if (!values.length) invalid();
  return values;
}

/** Workspace packages; exclusions apply to the union of patterns, regardless of order. */
export function workspaces(root) {
  const globs = [];
  if (existsSync(join(root, 'package.json'))) {
    const w = readJson(root, 'package.json').workspaces;
    globs.push(...(Array.isArray(w) ? w : (w?.packages ?? [])));
  }
  if (existsSync(join(root, 'pnpm-workspace.yaml'))) {
    globs.push(...pnpmPackages(read(root, 'pnpm-workspace.yaml')));
  }
  const exclusions = globs
    .filter((g) => g.startsWith('!'))
    .map((g) => globToRegex(g.slice(1).replace(/^\.\//, '').replace(/\/+$/, '')));
  const out = globs
    .filter((g) => !g.startsWith('!'))
    .flatMap((g) => expandDirs(root, g))
    .filter(
      (d) => !exclusions.some((re) => re.test(d)) && existsSync(join(root, d, 'package.json')),
    );
  return [...new Set(out)];
}

function detectMatch(root, { file, contains }) {
  return [file, ...workspaces(root).map((w) => `${w}/${file}`)].some(
    (n) => existsSync(join(root, n)) && (!contains || read(root, n).includes(contains)),
  );
}

/** The only preset (React); `detected` is false when no package.json depends on react. */
export function detectStack(root) {
  const preset = JSON.parse(readFileSync(join(PKG, 'stacks', 'node-react.json'), 'utf8'));
  return { ...preset, detected: detectMatch(root, preset.detect) };
}

function nodeInstall(root) {
  if (existsSync(join(root, 'pnpm-lock.yaml')))
    return 'corepack enable && pnpm install --frozen-lockfile';
  if (existsSync(join(root, 'yarn.lock'))) return 'corepack enable && yarn install --immutable';
  return existsSync(join(root, 'package-lock.json')) ? 'npm ci' : 'npm install';
}

function coverageEnforced(root, preset) {
  return preset.coverageEnforcedIf.some(([file, text]) => detectMatch(root, { file, contains: text }));
}

function resolveGates(root, preset) {
  const scripts = existsSync(join(root, 'package.json'))
    ? (readJson(root, 'package.json').scripts ?? {})
    : {};
  const wsScripts = new Set(
    workspaces(root).flatMap((w) => Object.keys(readJson(root, `${w}/package.json`).scripts ?? {})),
  );
  const pnpm = existsSync(join(root, 'pnpm-workspace.yaml'));
  const run = (s) => {
    if (scripts[s]) return `npm run ${s}`;
    if (!wsScripts.has(s)) return null;
    return pnpm ? `pnpm -r --if-present run ${s}` : `npm run ${s} --workspaces --if-present`;
  };
  const gates = {};
  for (const [name, spec] of Object.entries(preset.gates)) {
    const cmd = spec.npmScripts.map(run).find(Boolean);
    if (cmd) gates[name] = spec.when ? { cmd, when: spec.when } : cmd;
  }
  return gates;
}

export function defaultConfig(root, preset, opts, { budgets, configPaths }) {
  const gates = resolveGates(root, preset);
  const hooks = Object.fromEntries(
    Object.entries(preset.hooks).map(([hook, names]) => [hook, names.filter((n) => gates[n])]),
  );
  const lint = {
    level: opts.lint ?? 'standard',
    engine: preset.lintEngine ?? null,
    options: { configPaths },
  };
  lint.pending = lint.level !== 'off' && lint.engine && missingTool(lint.engine, root);
  if (lint.level !== 'off' && lint.engine && !lint.pending) addLintGate(gates, hooks);
  if (!lint.pending) delete lint.pending;
  const ws = workspaces(root);
  const perPackage = (dirs) =>
    ws.length ? [...dirs, ...ws.flatMap((w) => dirs.map((d) => `${w}/${d}`))] : dirs;
  const ci = { ...preset.ci, 'install-command': nodeInstall(root) };
  if (ci['install-command'] === 'npm ci') ci.cache = 'npm';
  const srcDirs = perPackage(preset.srcDirs).filter((d) => existsSync(join(root, d)));
  return {
    $schema: '../../.aquila/schema/aquila.schema.json',
    version: 1,
    project: basename(root),
    stack: preset.name,
    mode: opts.mode ?? 'local',
    tools: opts.tools ?? ['copilot', 'claude', 'codex'],
    language: { code: 'en', docs: opts.lang ?? 'en', answers: opts.lang ?? 'en' },
    srcDirs,
    testDirs: perPackage(preset.testDirs ?? ['test']).filter((d) => existsSync(join(root, d))),
    ...(ws.length ? { workspaces: ws } : {}),
    gates,
    hooks,
    coverage: {
      ...preset.coverage,
      enforced: Boolean(gates.coverage) && coverageEnforced(root, preset),
    },
    lint,
    ci,
    budgets,
    review: { prMaxFiles: opts.prMaxFiles ?? 30 },
    qa: {
      tracker: 'GitHub Issues',
      environment: 'dev',
      appUrl: null,
      browsers: 'Chrome, Firefox, Safari',
      testUser: null,
    },
  };
}
