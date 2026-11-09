import { existsSync, lstatSync, readdirSync, readFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { globToRegex } from './glob.mjs';
import { addLintGate, missingTool } from './lint.mjs';
import { PROFILE } from './profile.mjs';

const PKG = join(dirname(fileURLToPath(import.meta.url)), '..');
const SKIP_DIRS = new Set([
  'node_modules',
  '.git',
  'dist',
  'build',
  'coverage',
]);
const read = (root, file) => readFileSync(join(root, file), 'utf8').replace(/^\uFEFF/, '');
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

/** The coverage gate's script is the test gate's script with coverage on (`jest` → `jest --coverage`). */
export function coverageRunsTests(root, gates) {
  const scripts = existsSync(join(root, 'package.json')) ? (readJson(root, 'package.json').scripts ?? {}) : {};
  const script = (gate) => {
    const cmd = typeof gate === 'string' ? gate : gate?.cmd;
    const name = /^npm run ([\w:.-]+)$/.exec(cmd ?? '')?.[1];
    return name ? scripts[name] : cmd;
  };
  const test = script(gates.test)?.trim();
  const cov = script(gates.coverage)?.trim();
  return Boolean(test && cov && cov.startsWith(test) && /coverage/.test(cov.slice(test.length)));
}

function detectMatch(root, { file, contains }) {
  return [file, ...workspaces(root).map((w) => `${w}/${file}`)].some(
    (n) => existsSync(join(root, n)) && (!contains || read(root, n).includes(contains)),
  );
}

/** This package's preset (stacks/<preset>.json): gates, hooks, coverage, configPaths. */
export function loadPreset() {
  return JSON.parse(readFileSync(join(PKG, 'stacks', `${PROFILE.preset}.json`), 'utf8'));
}

/** The only preset; `detected` is false when no package.json depends on the stack's framework. */
export function detectStack(root) {
  const preset = loadPreset();
  return { ...preset, detected: detectMatch(root, preset.detect) };
}

/** Major of a dependency: installed (hoisted too, up to the repository) first, else the declared range. */
export function dependencyMajor(root, dep) {
  let installed = null;
  for (let dir = root; ; dir = dirname(dir)) {
    const file = join(dir, 'node_modules', ...dep.split('/'), 'package.json');
    if (existsSync(file)) {
      installed = JSON.parse(readFileSync(file, 'utf8')).version;
      break;
    }
    if (dirname(dir) === dir || existsSync(join(dir, '.git'))) break;
  }
  const pkg = join(root, 'package.json');
  const declared = existsSync(pkg)
    ? ((m) => m.dependencies?.[dep] ?? m.devDependencies?.[dep] ?? m.peerDependencies?.[dep])(
        JSON.parse(readFileSync(pkg, 'utf8')),
      )
    : null;
  const major = /\d+/.exec(installed || declared || '')?.[0];
  return major ? Number(major) : null;
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

const METRICS = ['statements', 'functions', 'lines', 'branches'];

/** The `{ … }` that follows `key` in a config file (brace counting), or null. */
function objectAfter(text, key) {
  const at = text.search(new RegExp(String.raw`\b${key}\b["']?\s*[:=]?\s*\{`));
  if (at < 0) return null;
  const start = text.indexOf('{', at);
  let depth = 0;
  for (let i = start; i < text.length; i++) {
    if (text[i] === '{') depth++;
    else if (text[i] === '}' && --depth === 0) return text.slice(start, i + 1);
  }
  return null;
}

/**
 * Coverage thresholds the project already enforces (jest coverageThreshold.global, vitest/vite
 * coverage.thresholds), so aquila does not propose its own default over them. null when none.
 * ponytail: textual read of the config (no evaluation) — a threshold computed in code is not seen.
 */
export function projectCoverage(root, preset) {
  for (const [file, key] of preset.coverageEnforcedIf) {
    if (!existsSync(join(root, file))) continue;
    const text = read(root, file);
    let block = objectAfter(text, key);
    if (block && key === 'coverageThreshold') block = objectAfter(block, 'global') ?? block;
    if (!block) continue;
    const found = {};
    for (const metric of METRICS) {
      const m = new RegExp(String.raw`["']?\b${metric}\b["']?\s*:\s*(\d+(?:\.\d+)?)`).exec(block);
      if (m) found[metric] = Number(m[1]);
    }
    if (Object.keys(found).length) return found;
  }
  return null;
}

/** Common identifier words, by language. ponytail: word-list heuristic; init --code-lang overrides it. */
const WORDS = {
  pt: 'buscar busca criar listar lista salvar atualizar excluir remover obter gerar enviar validar calcular carregar usuario usuarios cliente clientes pedido pedidos produto produtos preco valor nome servico empresa paciente pacientes fatura consulta agenda cadastro senha endereco quantidade ativo novo erro mensagem resposta requisicao arquivo tela pagina botao formulario falha sucesso dia hora mes ano tipo descricao codigo pagamento estoque venda vendas compra insumo baixo alerta ajuda navegacao configuracao permissao perfil filtro pesquisa relatorio item itens'.split(' '),
  en: 'get find fetch create list save update delete remove load send validate calculate user users customer customers order orders product products price value name service company patient invoice appointment schedule password address quantity active new error message response request file screen page button form failure success day hour month year type description code payment stock sale sales purchase low alert help navigation settings permission profile filter search report item items handle'.split(' '),
};

/**
 * Language of the project's own identifiers (declared names in srcDirs): 'pt' or 'en'.
 * The framework's API words (useState, Injectable…) are not declarations, so they don't count.
 */
export function detectCodeLanguage(root, srcDirs) {
  const files = [];
  const visit = (dir) => {
    if (files.length >= 400 || !existsSync(join(root, dir))) return;
    for (const name of readdirSync(join(root, dir)).sort()) {
      const rel = `${dir}/${name}`;
      if (SKIP_DIRS.has(name) || lstatSync(join(root, rel)).isSymbolicLink()) continue;
      if (lstatSync(join(root, rel)).isDirectory()) visit(rel);
      else if (/\.(?:[cm]?[jt]sx?)$/.test(name) && !/\.d\.ts$/.test(name)) files.push(rel);
    }
  };
  for (const dir of srcDirs) visit(dir);
  const count = { pt: 0, en: 0 };
  const declared =
    /(?:function|const|let|var|class|interface|type|enum)\s+([A-Za-z_$][\w$]*)|^\s*(?:(?:public|private|protected|async|static|readonly)\s+)*([a-z_$][\w$]*)\s*\(/gm;
  const strip = (w) => w.normalize('NFD').replaceAll(/[̀-ͯ]/g, '').toLowerCase();
  for (const file of files) {
    for (const m of read(root, file).matchAll(declared)) {
      const words = (m[1] ?? m[2]).split(/(?=[A-Z])|_/).map(strip).filter(Boolean);
      for (const w of words) for (const lang of ['pt', 'en']) if (WORDS[lang].includes(w)) count[lang]++;
    }
  }
  return count.pt >= 5 && count.pt >= count.en * 0.6 ? 'pt' : 'en';
}

/**
 * The project's command for each preset gate. A script that fixes (`--fix`, `--write`) never becomes a
 * gate: in a hook it would change files in the middle of a commit. `rewrite` swaps obsolete commands
 * (e.g. `next lint`, removed in Next 16).
 */
function resolveGates(root, preset, notes) {
  const pkg = existsSync(join(root, 'package.json')) ? readJson(root, 'package.json') : {};
  const scripts = pkg.scripts ?? {};
  // Every workspace's command per script: `npm run s --workspaces` runs them all.
  const wsScripts = new Map();
  for (const w of workspaces(root))
    for (const [name, cmd] of Object.entries(readJson(root, `${w}/package.json`).scripts ?? {}))
      wsScripts.set(name, [...(wsScripts.get(name) ?? []), cmd]);
  const pnpm = existsSync(join(root, 'pnpm-workspace.yaml'));
  const fixing = (cmd) =>
    /(?:^|\s)--(?:fix|write)(?=\s|=|$)/.test(cmd) || /\bprettier\b[^&|;]*\s-w(?=\s|$)/.test(cmd);
  const fixes = (s) => [scripts[s], ...(wsScripts.get(s) ?? [])].some((c) => c && fixing(c));
  const run = (s) => {
    if (fixes(s)) return null;
    if (scripts[s]) return `npm run ${s}`;
    if (!wsScripts.has(s)) return null;
    return pnpm ? `pnpm -r --if-present run ${s}` : `npm run ${s} --workspaces --if-present`;
  };
  const major = dependencyMajor(root, PROFILE.framework);
  const gates = {};
  for (const [name, spec] of Object.entries(preset.gates)) {
    const script = spec.npmScripts.find((s) => run(s));
    let cmd = script ? run(script) : null;
    const rewrite = (preset.rewrite ?? []).find(
      (r) => script && new RegExp(r.match).test(scripts[script] ?? '') && major !== null && major >= r.fromMajor,
    );
    if (rewrite) {
      cmd = rewrite.cmd;
      notes?.push(`ℹ gates.${name}: \`${scripts[script]}\` → \`${cmd}\` (${rewrite.why})`);
    }
    const fixers = spec.npmScripts.filter(fixes);
    if (!cmd && fixers.length)
      notes?.push(
        `! gates.${name}: script ${fixers.join(', ')} changes files (--fix/--write) and is not used in hooks — add a check-only script (e.g. "${name}:check") and run init again, or set gates.${name}`,
      );
    if (cmd) gates[name] = spec.when ? { cmd, when: spec.when } : cmd;
  }
  return gates;
}

export function defaultConfig(root, preset, opts, { budgets, configPaths, notes }) {
  const gates = resolveGates(root, preset, notes);
  const hooks = Object.fromEntries(
    Object.entries(preset.hooks).map(([hook, names]) => [hook, names.filter((n) => gates[n])]),
  );
  // A coverage script that is the test command plus coverage runs the same suite: in CI, test + coverage would
  // run every test twice. A different coverage command keeps test (a passing coverage must not hide it).
  if (hooks.ci?.includes('coverage') && coverageRunsTests(root, gates))
    hooks.ci = hooks.ci.filter((n) => n !== 'test');
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
  // Identifiers: --code-lang, else detected; a Portuguese codebase takes the docs variant (pt-BR/pt-PT).
  const docs = opts.lang ?? 'en';
  const detected = detectCodeLanguage(root, srcDirs);
  const code = opts.codeLang ?? (detected === 'pt' ? (docs.startsWith('pt') ? docs : 'pt-BR') : 'en');
  if (!opts.codeLang && detected === 'pt')
    notes?.push(`ℹ language.code ${code}: identifiers in the source are in Portuguese (--code-lang=… to change)`);
  const existing = projectCoverage(root, preset);
  if (existing)
    notes?.push(
      `ℹ coverage from the project's own thresholds: ${Object.entries(existing).map(([k, v]) => `${k} ${v}`).join(', ')}`,
    );
  return {
    $schema: '../../.aquila/schema/aquila.schema.json',
    version: 1,
    project: basename(root),
    stack: preset.name,
    mode: opts.mode ?? 'local',
    tools: opts.tools ?? ['copilot', 'claude', 'codex'],
    language: { code, docs, answers: docs },
    srcDirs,
    testDirs: perPackage(preset.testDirs ?? ['test']).filter((d) => existsSync(join(root, d))),
    ...(ws.length ? { workspaces: ws } : {}),
    gates,
    hooks,
    coverage: {
      ...(existing ?? preset.coverage),
      enforced: Boolean(gates.coverage) && coverageEnforced(root, preset),
    },
    lint,
    ci,
    budgets,
    review: { prMaxFiles: opts.prMaxFiles ?? 30 },
    qa: { tracker: 'GitHub Issues', ...PROFILE.qa },
  };
}
