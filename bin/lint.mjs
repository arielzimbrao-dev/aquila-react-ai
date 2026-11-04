import { existsSync, readFileSync, rmSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { PROFILE } from './profile.mjs';

const NAME = PROFILE.pkg;
const PKG = join(dirname(fileURLToPath(import.meta.url)), '..');
export const LINT_LEVELS = { off: [], standard: ['standard'], high: ['standard', 'high'] };
/** `lint --baseline` output (ESLint bulk suppressions): violations recorded there do not fail the gate. */
export const BASELINE = 'docs/ai/lint-baseline.json';
const posix = (path) => path.split('\\').join('/');
const CORE_PREFIXES = { '@typescript-eslint': 'typescript-eslint', sonarjs: 'eslint-plugin-sonarjs', unicorn: 'eslint-plugin-unicorn', jest: 'eslint-plugin-jest' };
/** Rule prefix → npm package: the common plugins plus this stack's own (profile). */
export const PLUGIN_PACKAGES = { ...CORE_PREFIXES, ...PROFILE.lint.plugins };

/** Catalog rules for a level (standard ⊂ high). */
export function lintRules(level) {
  const catalog = JSON.parse(readFileSync(join(PKG, 'lint', 'rules.json'), 'utf8'));
  return catalog.rules.filter((r) => (LINT_LEVELS[level] ?? []).includes(r.level));
}

/** Installed version of a package as the project resolves it (hoisted workspaces included), or null. */
export function installedVersion(root, pkg) {
  for (let dir = root; ; dir = dirname(dir)) {
    const file = join(dir, 'node_modules', ...pkg.split('/'), 'package.json');
    if (existsSync(file)) return JSON.parse(readFileSync(file, 'utf8')).version ?? null;
    if (dirname(dir) === dir || existsSync(join(dir, '.git'))) return null;
  }
}

/** ESLint's CLI as the project resolves it (its node_modules, or hoisted by npm/pnpm workspaces). */
export function eslintBin(root) {
  for (let dir = root; ; dir = dirname(dir)) {
    const bin = join(dir, 'node_modules', 'eslint', 'bin', 'eslint.js');
    if (existsSync(bin)) return bin;
    if (dirname(dir) === dir || existsSync(join(dir, '.git'))) return null;
  }
}

const major = (version) => Number(/^(\d+)/.exec(version ?? '')?.[1] ?? NaN);
const isTypeScript = (root) => existsSync(join(root, 'tsconfig.json'));

export function missingTool(engine, root) {
  if (engine !== 'eslint') return null;
  const version = installedVersion(root, 'eslint');
  if (!eslintBin(root))
    return `ESLint is not installed in the project — npm i -D ${installSpecs(root, ['eslint', ...(isTypeScript(root) ? ['typescript-eslint'] : [])]).join(' ')}, or lint.level = off`;
  // aquila's config is a flat config: ESLint 8 (.eslintrc) cannot load it.
  if (version && major(version) < 9)
    return `ESLint ${version} found: ${NAME} lint needs ESLint ≥ 9 (flat config) — npm i -D ${installSpecs(root, ['eslint']).join(' ')}, or lint.level = off`;
  // Without typescript-eslint every .ts file is a parse error, not a lint finding.
  if (isTypeScript(root) && !installedVersion(root, 'typescript-eslint'))
    return `typescript-eslint is not installed (tsconfig.json found: .ts files cannot be parsed) — npm i -D ${installSpecs(root, ['typescript-eslint']).join(' ')}`;
  return null;
}

/** Packages the level's rules need (from lint/rules.json), plus typescript-eslint on TS projects. */
function neededPlugins(root, level) {
  const prefixes = new Set();
  for (const rule of lintRules(level))
    for (const e of rule.enforce?.eslint ?? []) {
      const name = e.rule ?? e.preset;
      if (name.includes('/')) prefixes.add(name.slice(0, name.lastIndexOf('/')));
    }
  const pkgs = [...prefixes].map((x) => PLUGIN_PACKAGES[x]).filter(Boolean);
  if (isTypeScript(root)) pkgs.push('typescript-eslint');
  return [...new Set(pkgs)];
}

/**
 * `npm i -D` specs that fit together: the peer range of this package, and for eslint-plugin-unicorn the line
 * of the installed ESLint (65.x needs ESLint ≥ 9.38 < 10; 66+ needs ESLint 10).
 */
function installSpecs(root, pkgs) {
  const eslint = major(installedVersion(root, 'eslint'));
  return pkgs.map((pkg) => {
    if (pkg === 'eslint-plugin-unicorn') return eslint >= 10 ? 'eslint-plugin-unicorn@">=66"' : 'eslint-plugin-unicorn@65.0.1';
    if (pkg === 'eslint' && Number.isNaN(eslint)) return 'eslint@^9.39.0';
    const range = PROFILE.lintPeers[pkg];
    return range ? `${pkg}@"${range}"` : pkg;
  });
}

/** Install specs for the plugins of `level` that are missing (empty: nothing to install). */
export function missingLintPlugins(root, level) {
  if (level === 'off' || !eslintBin(root)) return [];
  return installSpecs(root, neededPlugins(root, level).filter((pkg) => !installedVersion(root, pkg)));
}

/** semver subset: `a || b`, `^x.y.z`, `~x.y.z`, `>=x.y.z`, `<x`, `x.y.z`; enough for the peer ranges here. */
export function satisfies(version, range) {
  const v = (version ?? '').split('.').map(Number);
  const cmp = (a, b) => {
    for (let i = 0; i < 3; i++) if ((a[i] ?? 0) !== (b[i] ?? 0)) return (a[i] ?? 0) - (b[i] ?? 0);
    return 0;
  };
  return range.split('||').some((alt) =>
    alt
      .trim()
      .split(/\s+/)
      .every((part) => {
        const m = /^(\^|~|>=|<=|>|<|=)?(\d+)(?:\.(\d+))?(?:\.(\d+))?$/.exec(part);
        if (!m) return false;
        const want = [Number(m[2]), Number(m[3] ?? 0), Number(m[4] ?? 0)];
        const c = cmp(v, want);
        switch (m[1]) {
          case '^':
            return c >= 0 && v[0] === want[0];
          case '~':
            return c >= 0 && v[0] === want[0] && v[1] === want[1];
          case '>=':
            return c >= 0;
          case '>':
            return c > 0;
          case '<=':
            return c <= 0;
          case '<':
            return c < 0;
          default:
            return c === 0;
        }
      }),
  );
}

/** Installed lint packages outside the ranges aquila supports, or pairs that cannot work together. */
export function lintPeerIssues(root, level) {
  if (level === 'off') return [];
  const issues = [];
  const eslint = installedVersion(root, 'eslint');
  for (const pkg of ['eslint', ...neededPlugins(root, level)]) {
    const version = installedVersion(root, pkg);
    const range = PROFILE.lintPeers[pkg];
    if (version && range && !satisfies(version, range))
      issues.push(`${pkg} ${version} is outside the supported range ${range} → npm i -D ${installSpecs(root, [pkg]).join(' ')}`);
  }
  const unicorn = installedVersion(root, 'eslint-plugin-unicorn');
  if (eslint && unicorn) {
    if (major(eslint) < 10 && major(unicorn) >= 66)
      issues.push(`eslint-plugin-unicorn ${unicorn} needs ESLint 10 (installed ${eslint}) → npm i -D eslint-plugin-unicorn@65.0.1`);
    if (major(eslint) >= 10 && major(unicorn) < 66)
      issues.push(`eslint-plugin-unicorn ${unicorn} does not support ESLint ${eslint} → npm i -D eslint-plugin-unicorn@">=66"`);
  }
  const missing = missingLintPlugins(root, level);
  if (missing.length) issues.push(`lint ${level}: plugins missing (their rules are skipped) → npm i -D ${missing.join(' ')} (or init --install)`);
  return issues;
}

/** An available engine does not prove every catalog rule is active. */
export function lintSummary(level, engine, root) {
  if (level === 'off') return 'lint off';
  const rules = lintRules(level);
  if (!engine) return `lint ${level}: ${rules.length} guidance rules (review/Sonar); no local engine`;
  const missing = missingTool(engine, root);
  if (missing) return `lint ${level}: engine ${engine} pending — ${missing}`;
  return `lint ${level} (${engine}): engine available; see lint rules for the local configuration and lint matrix for the catalog`;
}

async function rulesText(level, engine, root, cfg) {
  const rules = lintRules(level);
  if (!rules.length) return `lint ${level}: no rules.`;
  const missing = missingTool(engine, root);
  let coverage = [];
  if (engine === 'eslint' && !missing) {
    const { buildEslintConfig } = await import('../lint/eslint/build.mjs');
    const { loadEslintPlugins } = await import('../lint/eslint/plugins.mjs');
    coverage = buildEslintConfig(
      { rules },
      {
        level,
        root,
        srcDirs: cfg.srcDirs ?? ['src'],
        testDirs: cfg.testDirs,
        testGlobs: cfg.lint?.testGlobs,
        configPaths: cfg.lint?.options?.configPaths,
        ticketPattern: cfg.lint?.options?.ticketPattern,
        aliases: cfg.lint?.options?.aliases,
        overrides: cfg.lint?.overrides,
        plugins: await loadEslintPlugins(root),
      },
    ).coverage;
  }
  const lines = rules.map((r) => {
    let local = ' (review/Sonar)';
    if (engine && r.enforce?.[engine]?.length) {
      if (missing) local = ' (engine pending; review)';
      else {
        const status = coverage.find((entry) => entry.id === r.id);
        local = status.pending.length
          ? ` (${status.configured ? 'partial' : 'no active rule'}: missing ${status.pending.join(', ')})`
          : ' (configured)';
      }
    }
    return `- ${r.id}${r.sonar ? ` [Sonar ${r.sonar}]` : ''} ${r.title}${local} — ${r.why}`;
  });
  const overrides = Object.entries(cfg.lint?.overrides ?? {});
  return `${NAME} quality rules — level ${level} (${rules.length}; configuration state, does not confirm execution or semantic coverage):\n${missing ? `! ${missing}\n` : ''}${lines.join('\n')}${overrides.length ? `\nProject overrides (lint.overrides): ${overrides.map(([k, v]) => `${k} → ${JSON.stringify(v)}`).join(', ')}` : ''}`;
}

async function matrixText(level) {
  const rules = lintRules(level);
  if (!rules.length) return `lint ${level}: no rules.`;
  const { pluginName } = await import('../lint/eslint/plugins.mjs');
  const rows = rules.map((rule) => {
    const eslint = (rule.enforce?.eslint ?? []).map(
      (entry) => entry.preset ?? pluginName(entry.rule) ?? 'core/local',
    );
    return `| ${rule.id} | ${[...new Set(eslint)].join(', ') || 'review/Sonar'} |`;
  });
  return [
    `Catalog capability — level ${level}; not an execution report.`,
    '| Rule | ESLint (required plugins) |',
    '|---|---|',
    ...rows,
    'Local mappings do not prove semantic equivalence to the principle or to Sonar. Use lint rules for the plugins on this machine.',
  ].join('\n');
}

export function lint(args, { root, loadConfig }) {
  const cfg = loadConfig();
  const opts = {};
  for (const arg of args) {
    if (arg.startsWith('--level=')) opts.level = arg.slice('--level='.length);
    else if (arg === '--fix') opts.fix = true;
    else if (arg === '--baseline') opts.baseline = true;
    else if (!['rules', 'matrix'].includes(arg))
      throw new Error(`unknown lint argument: ${arg} (use rules, matrix, --level=…, --fix or --baseline)`);
  }
  const level = opts.level ?? cfg.lint?.level ?? 'off';
  if (!Object.hasOwn(LINT_LEVELS, level)) throw new Error('--level is off, standard or high');
  const engine = cfg.lint?.engine ?? null;
  if (args.includes('rules') && args.includes('matrix'))
    throw new Error('choose lint rules or lint matrix, not both');
  if (args.includes('rules') || args.includes('matrix')) {
    const text = args.includes('matrix') ? matrixText(level) : rulesText(level, engine, root, cfg);
    return text.then((value) => (console.log(value), 0));
  }
  if (level === 'off') {
    console.log('lint off (docs/ai/aquila.json → lint.level = off)');
    return 0;
  }
  if (engine !== 'eslint') {
    console.log(
      `no local lint engine: ${level} rules apply via aquila-review and Sonar (npx ${NAME} lint rules)`,
    );
    return 0;
  }
  const missing = missingTool(engine, root);
  if (missing) {
    console.error(`✗ ${missing}`);
    return 1;
  }
  const baseline = cfg.lint?.baseline ?? BASELINE;
  // Bulk suppressions arrived in ESLint 9.24.
  const version = installedVersion(root, 'eslint');
  const suppressions = Boolean(version) && !satisfies(version, '<9.24.0');
  if (opts.baseline && !suppressions) {
    console.error(`✗ lint --baseline needs ESLint ≥ 9.24 (installed ${version})`);
    return 1;
  }
  const dirs = [...(cfg.srcDirs ?? ['src']), ...(cfg.testDirs ?? ['test'])].filter((d) =>
    existsSync(join(root, d)),
  );
  const config = posix(relative(root, join(PKG, 'lint', 'eslint', 'eslint.config.mjs')));
  // Baseline: record every current violation (adoption on legacy code); afterwards only new ones fail.
  if (opts.baseline && existsSync(join(root, baseline))) rmSync(join(root, baseline));
  const baselineArgs = !suppressions
    ? []
    : opts.baseline
      ? ['--suppress-all', '--suppressions-location', baseline]
      : existsSync(join(root, baseline))
        ? ['--suppressions-location', baseline, '--pass-on-unpruned-suppressions']
        : [];
  const result = spawnSync(
    process.execPath,
    [
      eslintBin(root),
      '--config',
      config,
      '--max-warnings=0',
      '--cache',
      '--cache-location',
      'node_modules/.cache/aquila-eslint',
      ...(opts.fix ? ['--fix'] : []),
      ...baselineArgs,
      ...dirs,
    ],
    {
      cwd: root,
      shell: false,
      stdio: 'inherit',
      env: { ...process.env, AQUILA_ROOT: root, AQUILA_LINT_LEVEL: level },
    },
  );
  if (result.error) console.error(`✗ eslint: ${result.error.message}`);
  else if (result.signal) console.error(`✗ eslint: killed by ${result.signal}`);
  else if (opts.baseline && result.status === 0)
    console.log(`✓ ${baseline}: current violations recorded — commit it; from now on only new ones fail (shrink it with \`npx ${NAME} lint --baseline\` after fixing)`);
  return result.status ?? 1;
}

/** lint-aquila complements the project's gates; it is never the only CI check. */
export function addLintGate(gates, hooks) {
  if (!Object.keys(gates).length || gates['lint-aquila']) return false;
  gates['lint-aquila'] = `npx ${NAME} lint`;
  hooks['pre-push'] = [...(hooks['pre-push'] ?? []), 'lint-aquila'];
  hooks.ci = [...(hooks.ci ?? []), 'lint-aquila'];
  return true;
}
